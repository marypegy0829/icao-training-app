
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Tool, Schema } from '@google/genai';
import { base64ToBytes, decodeAudioData, downsampleTo16k } from './audioUtils';
import { AssessmentData, Scenario, DifficultyLevel } from '../types';
import { airportService } from './airportService';

interface LiveClientCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Error) => void;
  onAudioData: (level: number) => void;
  onTurnComplete: () => void;
  onTranscript: (text: string, role: 'user' | 'ai', isPartial: boolean) => void;
  onAssessment: (data: AssessmentData) => void;
}

// Helper to handle loose types (string numbers) and clamp values
function parseScore(val: any): number {
    const num = Number(val);
    if (isNaN(num)) return 1;
    return Math.max(1, Math.min(6, Math.round(num)));
}

// Helper: Clean JSON output from LLM (remove markdown, extra text)
function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/, '');
  
  // Find the first '{' and last '}' to handle potential preamble/postscript
  const firstOpen = cleaned.indexOf('{');
  const lastClose = cleaned.lastIndexOf('}');
  
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    cleaned = cleaned.substring(firstOpen, lastClose + 1);
  }
  
  return cleaned;
}

// Helper to safely parse and default the assessment data to avoid runtime crashes
function safeParseAssessment(data: any): AssessmentData {
    // Robustly parse scores even if they come as strings
    return {
        overallScore: parseScore(data.overallScore),
        pronunciation: parseScore(data.pronunciation),
        structure: parseScore(data.structure),
        vocabulary: parseScore(data.vocabulary),
        fluency: parseScore(data.fluency),
        comprehension: parseScore(data.comprehension),
        interactions: parseScore(data.interactions),
        
        executiveSummary: data.executiveSummary || { 
            assessment: "Data missing from AI response.", 
            safetyMargin: "Unknown", 
            frictionPoints: "Unknown" 
        },
        dimensionalDetails: data.dimensionalDetails || {
            pronunciation: "N/A",
            structure: "N/A",
            vocabulary: "N/A",
            fluency: "N/A",
            comprehension: "N/A",
            interactions: "N/A"
        },
        deepAnalysis: Array.isArray(data.deepAnalysis) ? data.deepAnalysis : [],
        remedialPlan: Array.isArray(data.remedialPlan) ? data.remedialPlan : ["Retry assessment to get a plan."],
        feedback: data.feedback || (data.executiveSummary ? data.executiveSummary.assessment : "")
    };
}

// Schema for the Assessment Report (used by gemini-3-flash-preview)
const assessmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: { type: Type.NUMBER, description: "Overall ICAO Level (Integer 1-6)." },
    pronunciation: { type: Type.NUMBER, description: "Score (Integer 1-6)." },
    structure: { type: Type.NUMBER, description: "Score (Integer 1-6)." },
    vocabulary: { type: Type.NUMBER, description: "Score (Integer 1-6)." },
    fluency: { type: Type.NUMBER, description: "Score (Integer 1-6)." },
    comprehension: { type: Type.NUMBER, description: "Score (Integer 1-6)." },
    interactions: { type: Type.NUMBER, description: "Score (Integer 1-6)." },
    
    executiveSummary: {
      type: Type.OBJECT,
      properties: {
        assessment: { type: Type.STRING, description: "Comprehensive summary in Simplified Chinese (150+ words)." },
        safetyMargin: { type: Type.STRING, description: "Assessment of safety risks due to language (Chinese)." },
        frictionPoints: { type: Type.STRING, description: "Specific instances of communication breakdown (Chinese)." }
      },
      required: ["assessment", "safetyMargin", "frictionPoints"]
    },
    
    dimensionalDetails: {
      type: Type.OBJECT,
      properties: {
        pronunciation: { type: Type.STRING, description: "Detailed analysis of accent, stress, and intonation (Chinese)." },
        structure: { type: Type.STRING, description: "Analysis of grammatical errors and sentence patterns (Chinese)." },
        vocabulary: { type: Type.STRING, description: "Analysis of phraseology usage and vocabulary range (Chinese)." },
        fluency: { type: Type.STRING, description: "Analysis of tempo, hesitation, and discourse markers (Chinese)." },
        comprehension: { type: Type.STRING, description: "Analysis of understanding and readback accuracy (Chinese)." },
        interactions: { type: Type.STRING, description: "Analysis of response time and clarification handling (Chinese)." }
      },
      required: ["pronunciation", "structure", "vocabulary", "fluency", "comprehension", "interactions"]
    },

    deepAnalysis: {
      type: Type.ARRAY,
      description: "List of 3-5 specific errors found in the transcript. MUST cite exact user words.",
      items: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING, description: "The EXACT quote from the 'User' in the transcript that contains the error." },
          issue: { type: Type.STRING, description: "Identify the error type (e.g., [STRUCTURE] Wrong preposition, [PRONUNCIATION] Mispronounced 'Altimeter')." },
          theory: { type: Type.STRING, description: "Explain WHY it is wrong based on ICAO Doc 9835 (Chinese)." },
          rootCause: { type: Type.STRING, description: "Likely cause (L1 interference, lack of practice) (Chinese)." },
          correction: { type: Type.STRING, description: "The correct standard phraseology or sentence (English)." }
        },
        required: ["context", "issue", "theory", "rootCause", "correction"]
      }
    },

    remedialPlan: {
      type: Type.ARRAY,
      description: "3 Actionable, specific training exercises (Chinese).",
      items: { type: Type.STRING }
    }
  },
  required: ["overallScore", "pronunciation", "structure", "vocabulary", "fluency", "comprehension", "interactions", "executiveSummary", "dimensionalDetails", "deepAnalysis", "remedialPlan"]
};

// Keep Tool definition for Live API (Function Calling fallback)
const assessmentToolDefinition: FunctionDeclaration = {
    name: "reportAssessment",
    description: "Generate the 6-Dimension ICAO Assessment Report.",
    parameters: assessmentSchema
};

const tools: Tool[] = [{ functionDeclarations: [assessmentToolDefinition] }];

export class LiveClient {
  private ai: GoogleGenAI;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private sessionPromise: Promise<any> | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private isInputMuted: boolean = false;
  
  // Noise Simulation
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  
  // Transcript State
  private fullTranscript: string = ""; 
  private currentInputPart: string = ""; // Buffer for streaming input
  
  private currentCallbacks: LiveClientCallbacks | null = null;
  private scenarioContext: Scenario | null = null;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  setInputMuted(muted: boolean) {
    this.isInputMuted = muted;
  }

  // --- AUDIO GENERATION ENGINE ---
  // Generates Brown Noise (Simulates Engine Rumble / Wind)
  private createCockpitNoise(ctx: AudioContext): AudioBuffer {
      const bufferSize = ctx.sampleRate * 5; // 5 seconds loop
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          // Brown noise algorithm (Integrated White Noise) with leak
          // This creates a -6dB/octave slope (Low frequency rumble)
          lastOut = (lastOut + (0.02 * white)) / 1.02;
          data[i] = lastOut * 3.5; // Compensate gain
      }
      return buffer;
  }

  private startCockpitNoise(enabled: boolean) {
      if (!enabled || !this.outputAudioContext) return;
      
      try {
          this.stopCockpitNoise(); // Stop any existing

          const noiseBuffer = this.createCockpitNoise(this.outputAudioContext);
          this.noiseSource = this.outputAudioContext.createBufferSource();
          this.noiseSource.buffer = noiseBuffer;
          this.noiseSource.loop = true;

          // Gain Node for Volume Control
          this.noiseGain = this.outputAudioContext.createGain();
          
          // -20dB equivalent (approx 0.1) creates a subtle background rumble
          // We want it audible but not overwhelming the voice.
          this.noiseGain.gain.value = 0.08; 

          this.noiseSource.connect(this.noiseGain);
          this.noiseGain.connect(this.outputAudioContext.destination);
          
          this.noiseSource.start();
          console.log("Cockpit Audio Environment: ENGAGED");
      } catch (e) {
          console.warn("Failed to start cockpit noise:", e);
      }
  }

  private stopCockpitNoise() {
      if (this.noiseSource) {
          try { this.noiseSource.stop(); } catch(e) {}
          this.noiseSource.disconnect();
          this.noiseSource = null;
      }
      if (this.noiseGain) {
          this.noiseGain.disconnect();
          this.noiseGain = null;
      }
  }

  // Generate prompts based on difficulty
  private getDifficultyInstruction(level: DifficultyLevel): string {
      switch (level) {
          case DifficultyLevel.LEVEL_3_TO_4:
              return `
              - **DIFFICULTY: LOW (Level 3-4 Upgrade)**.
              - SPEECH: Speak SLOWLY and CLEARLY. Articulate every word.
              - VOCABULARY: Use strictly standard ICAO phraseology. Avoid idioms.
              - ATTITUDE: Be helpful and patient. Correct errors gently if needed.
              - COMPLEXITY: Keep instructions simple (single step).
              `;
          case DifficultyLevel.LEVEL_4_RECURRENT:
              return `
              - **DIFFICULTY: MEDIUM (Level 4 Recurrent)**.
              - SPEECH: Speak at a normal, conversational pace.
              - VOCABULARY: Standard phraseology mixed with occasional plain English for non-routine situations.
              - ATTITUDE: Professional and efficient.
              - COMPLEXITY: Standard routine operations with minor complications.
              `;
          case DifficultyLevel.LEVEL_4_TO_5:
              return `
              - **DIFFICULTY: HIGH (Level 4-5 Upgrade)**.
              - SPEECH: Speak quickly but clearly.
              - VOCABULARY: Use varied vocabulary and idiomatic expressions appropriate for aviation.
              - ATTITUDE: Professional but less helpful. Expect the pilot to understand implied instructions.
              - COMPLEXITY: Introduce compound instructions (e.g., "Turn left heading 090, climb FL240, after passing ABC direct XYZ").
              `;
          case DifficultyLevel.LEVEL_5_TO_6:
              return `
              - **DIFFICULTY: EXTREME (Level 6 Examiner)**.
              - SPEECH: Speak FAST and naturalistically. Use a slight accent if possible.
              - VOCABULARY: Extensive, nuanced vocabulary.
              - ATTITUDE: Strict and demanding. Do not repeat unless asked.
              - COMPLEXITY: High workload. Introduce subtle failures and conflicting information to test situational awareness.
              `;
          default:
              return "";
      }
  }

  // --- NEW: Voice Selection Logic ---
  private getVoiceName(airportCode: string, enabled: boolean): string {
      // Default / Standard voice
      if (!enabled || !airportCode || airportCode.length < 2) return 'Kore';

      const code = airportCode.toUpperCase();
      const prefix = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);

      // 1. Deep / Authoritative Male Voices (Fenrir)
      // Suitable for: Asia (Z, R, V), Russia (U), some Africa
      if (['Z', 'R', 'V', 'U'].includes(prefix1)) {
          return 'Fenrir';
      }

      // 2. Standard Deep Male (Charon)
      // Suitable for: Middle East (O), Europe (E, L), South America (S)
      if (['O', 'E', 'L', 'S', 'F', 'H', 'G', 'D'].includes(prefix1)) {
          return 'Charon';
      }

      // 3. Clear Female (Aoede)
      // Suitable for: North America (K, C), Oceania (Y, N)
      if (['K', 'C', 'Y', 'N', 'M'].includes(prefix1)) {
          return 'Aoede';
      }

      // Fallback
      return 'Kore';
  }

  // --- NEW: Enhanced Accent Prompts ---
  private getAccentInstruction(airportCode: string, enabled: boolean): string {
      if (!enabled || !airportCode || airportCode.length < 2) {
          return "- **ACCENT**: Use Standard ICAO English / Generic US/UK Accent. Clear and Neutral.";
      }

      const code = airportCode.toUpperCase();
      const prefix = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);

      const base = "!!! CRITICAL VOICE INSTRUCTION !!!\nACT AS A LOCAL ATC CONTROLLER. IMPERSONATE THE ACCENT DESCRIBED BELOW. DO NOT SPEAK STANDARD AMERICAN ENGLISH.";

      // --- ASIA ---
      if (prefix1 === 'Z') { // China
          return `${base}
### **🌏 REGION Z (China) - "Beijing/Shanghai Control"**
* **Phonology**: /θ/ -> /s/ (Three->Sree), Final consonants swallowed.
* **Prosody**: Staccato, forceful, high volume.
* **Lexical**: Strict use of "Decimal", "Standby".
* **Example**: "Air China 981, radar contact. Turn right heading 090."`;
      }
      if (prefix === 'RK') { // Korea
          return `${base}
### **🌏 REGION RK (Korea) - "Incheon Control"**
* **Phonology**: P/F merger (Frequency->Prequency), R/L liquid sound.
* **Prosody**: Syllable-timed, distinct high-low-high pitch at end of phrases.
* **Lexical**: Very polite structure.
* **Example**: "Korean Air 85, change prequency one two one decimal pipe."`;
      }
      if (prefix1 === 'V') { // India / SE Asia
          return `${base}
### **🌏 REGION V (India/Thailand) - "Mumbai/Bangkok Control"**
* **Phonology**: Retroflex T/D (curled tongue). W/V merger.
* **Prosody**: Musical/Sing-song rhythm. Very fast (130+ WPM).
* **Lexical**: "Confirm" used often as filler.
* **Example**: "Vistara 202, confirm visual? Do one thing, descend level eight zero."`;
      }
      if (prefix === 'RJ' || prefix === 'RO') { // Japan
          return `${base}
### **🌏 REGION RJ (Japan) - "Tokyo Control"**
* **Phonology**: Katakana effect (Street->Sutorito), R/L merger.
* **Prosody**: Monotonic, flat rhythm, robot-like precision.
* **Example**: "All Nippon 5, rradar contact. Prease cimb and maintain."`;
      }

      // --- MIDDLE EAST & AFRICA ---
      if (prefix1 === 'O' || ['HE', 'HA', 'DT', 'DA', 'GM', 'LG', 'LT'].includes(prefix)) { // Middle East / North Africa / Turkey
          return `${base}
### **🌏 REGION O/H (Middle East/Arab) - "Dubai/Cairo Control"**
* **Phonology**: Guttural /h/ and /k/. P/B confusion (Parking->Barking). Trilled R.
* **Prosody**: Deep, resonant, deliberate pace.
* **Lexical**: Formal address ("Captain").
* **Example**: "Emirates 5, cleared to rand runway one two reft. Contact ground."`;
      }
      if (['FA', 'DN', 'DG', 'HK', 'FL', 'FW'].includes(prefix)) { // Sub-Saharan Africa
          return `${base}
### **🌍 REGION F/D (Africa) - "Jo'burg/Lagos Control"**
* **Phonology**: Non-rhotic (no hard R). Distinct vowel sounds. 
* **Prosody**: rhythmic, sometimes rapid.
* **Example**: "Springbok 202, lineup and wait. Traffic crossing."`;
      }

      // --- SOUTH AMERICA ---
      if (prefix1 === 'S' || prefix1 === 'M') { // South/Central America
          return `${base}
### **🌎 REGION S/M (Latin America) - "Bogota/Sao Paulo/Mexico Control"**
* **Phonology**: Vowel insertion before S-clusters (Station->E-station). H is silent (Hotel->Otel).
* **Prosody**: Syllable-timed (Machine gun rhythm). Rapid Spanish-influenced cadence.
* **Lexical**: "Roger" used frequently.
* **Example**: "Avianca 5, turn left, e-speed one eight zero. Contact e-tower."`;
      }

      // --- RUSSIA / CIS ---
      if (prefix1 === 'U') { // Russia
          return `${base}
### **🌏 REGION U (Russia) - "Moscow Control"**
* **Phonology**: No /th/ sound (Three->Tree/Zree). Rolling R. Palatalized consonants.
* **Prosody**: Heavy, falling intonation. Serious tone.
* **Example**: "Aeroflot 101, descend level tree-zero-zero. Position check."`;
      }

      // --- OCEANIA ---
      if (prefix1 === 'Y' || prefix1 === 'N') { // Australia/NZ
          return `${base}
### **🌏 REGION Y/N (Oceania) - "Sydney/Auckland Control"**
* **Phonology**: Vowel shifts (Day->Die). Non-rhotic. 
* **Prosody**: Up-speak (Rising intonation at end). Relaxed but professional.
* **Lexical**: "G'day", "No worries" (rarely on radio but tone implies it).
* **Example**: "Qantas 6, g'day, track direct Merlin, maintain flight level 350."`;
      }

      // --- EUROPE ---
      if (prefix === 'LF') { // France
          return `${base}
### **🌏 REGION E (France) - "Paris Control"**
* **Phonology**: H-dropping. Th->Z. Uvular R.
* **Prosody**: Stress on last syllable.
* **Example**: "Air France 44, turn left 'eading tree-six-zero. Descend."`;
      }
      if (prefix1 === 'E' || prefix1 === 'L') { // General Europe
          return `${base}
### **🌏 REGION E (Europe) - "Eurocontrol"**
* **Phonology**: Varied but generally clear. Slight German/Italian inflections if applicable.
* **Prosody**: Professional, standard pace.
* **Example**: "Lufthansa 1, radar contact. Proceed direct."`;
      }

      // --- NORTH AMERICA ---
      if (prefix1 === 'K' || prefix1 === 'C') { // USA/Canada
          return `${base}
### **🌏 REGION K (USA) - "New York/Chicago Approach"**
* **Phonology**: Flapped T (Water->Wadder). Hard R.
* **Prosody**: Very Fast (150+ WPM). Fluid.
* **Lexical**: "Point" instead of "Decimal". Slang ("Ride", "Smooth").
* **Example**: "United 6, turn left 220, intercept localizer, keep speed up. Tower 119.1. G'day."`;
      }
      
      return "- **ACCENT**: Use Standard ICAO English with a slight regional touch appropriate for the location if known.";
  }

  async connect(
      scenario: Scenario, 
      callbacks: LiveClientCallbacks, 
      difficulty: DifficultyLevel = DifficultyLevel.LEVEL_4_RECURRENT, 
      airportCode: string = "",
      accentEnabled: boolean = false, 
      cockpitNoiseEnabled: boolean = false, 
      customSystemInstruction?: string
  ) {
    // 1. Clean up potential previous sessions or contexts
    await this.disconnect();
    
    this.currentCallbacks = callbacks;
    this.scenarioContext = scenario;
    this.fullTranscript = "";
    this.currentInputPart = "";

    // 2. Initialize Audio Contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    try {
        // ALLOW BROWSER TO CHOOSE DEFAULT SAMPLE RATE
        // Hardcoding sampleRate (e.g. 24000) causes failures on some hardware
        this.inputAudioContext = new AudioContextClass();
        this.outputAudioContext = new AudioContextClass();
    } catch (e) {
        console.warn("Failed to initialize AudioContext", e);
        callbacks.onError(new Error("Audio hardware initialization failed."));
        return;
    }
    
    try {
      if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
      if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
            channelCount: 1, 
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
      });
      console.log("Microphone access granted. Native Sample Rate:", this.inputAudioContext.sampleRate);
    } catch (err) {
      console.error("Audio Access Error:", err);
      callbacks.onError(new Error("Microphone permission denied. Please allow access in settings."));
      return;
    }

    const outputNode = this.outputAudioContext.createGain();
    outputNode.connect(this.outputAudioContext.destination);

    // 3. START COCKPIT NOISE (If Enabled)
    this.startCockpitNoise(cockpitNoiseEnabled);

    // Dynamic Difficulty Instruction
    const difficultyPrompt = this.getDifficultyInstruction(difficulty);

    // Airport Context Injection Logic
    let targetCode = airportCode ? airportCode.toUpperCase() : "";
    let airportDetailsStr = "";
    
    // --- UPDATED LOGIC: RANDOM AIRPORT FALLBACK ---
    if (!targetCode || targetCode === "GENERIC" || targetCode.length < 3) {
        try {
            const randomAirport = await airportService.getRandomAirport();
            if (randomAirport) {
                targetCode = randomAirport.icao_code;
                console.log(`LiveClient: Randomly selected airport: ${targetCode}`);
            } else {
                targetCode = "ZBAA"; // Ultimate fallback
            }
        } catch (e) {
            targetCode = "ZBAA";
            console.warn("Failed to get random airport", e);
        }
    }

    // --- FETCH REAL AIRPORT DATA FROM SUPABASE ---
    try {
        const airportData = await airportService.getAirportByCode(targetCode);
        if (airportData) {
            console.log("LiveClient: Fetched airport data for", targetCode);
            // Convert JSONB arrays/objects to string representation for the prompt
            const rwys = Array.isArray(airportData.runways) ? airportData.runways.join(", ") : "Standard";
            const freqs = typeof airportData.frequencies === 'object' ? JSON.stringify(airportData.frequencies) : "Standard";
            
            // Build Procedure String
            let procStr = "";
            if (airportData.procedures) {
                if (airportData.procedures.sids && airportData.procedures.sids.length > 0) {
                    procStr += `\n* EXPECTED SIDs (Departures): ${airportData.procedures.sids.join(', ')}`;
                }
                if (airportData.procedures.stars && airportData.procedures.stars.length > 0) {
                    procStr += `\n* EXPECTED STARs (Arrivals): ${airportData.procedures.stars.join(', ')}`;
                }
            }
            if (airportData.taxi_routes) {
                // Flatten taxi routes object to string
                const routes = Object.entries(airportData.taxi_routes).map(([k, v]) => `${k}: ${v}`).join(' | ');
                procStr += `\n* LOCAL TAXI ROUTES: ${routes}`;
            }

            airportDetailsStr = `
            - **AIRPORT DATA**:
              * Name: ${airportData.name} (${airportData.city})
              * Runways: ${rwys}
              * Frequencies: ${freqs}
              * Elevation: ${airportData.elevation_ft}ft
              ${procStr}
            `;
        }
    } catch (e) {
        console.warn("Failed to fetch airport data", e);
    }

    // Dynamic Voice & Accent
    const voiceName = this.getVoiceName(targetCode, accentEnabled);
    const accentPrompt = this.getAccentInstruction(targetCode, accentEnabled);
    
    console.log(`LiveClient Config: Airport=${targetCode}, Accent=${accentEnabled}, Voice=${voiceName}`);

    const airportInstruction = `
    # AIRPORT CONTEXT: ${targetCode}
    - **LOCATION**: You are acting as ATC at **${targetCode}**.
    ${airportDetailsStr}
    - **REALISM RULE**: You MUST use the specific runways, frequencies, SIDs, and STARs listed above if applicable.
    - **ADAPTATION**: Adapt the current scenario (${scenario.title}) to fit the specific layout of ${targetCode}.
    - **DIVERSION**: If pilot requests diversion, suggest realistic nearby airports for ${targetCode}.
    `;

    // Extract dynamic environment settings to be reusable
    const environmentContext = `
    ${airportInstruction}

    ${difficultyPrompt}
    
    ${accentPrompt}
    `;

    const baseInstruction = `
    # ROLE: Senior ICAO English Examiner (Level 4-6) & Senior Air Traffic Controller (20+ years experience)
    # OBJECTIVE: Conduct a high-fidelity radiotelephony simulation and examination.

    # YOU ARE:
    1. A STRICT ATC: You use standard ICAO phraseology perfectly. You do not tolerate ambiguity.
    2. AN EXAMINER: You are evaluating the candidate on: Pronunciation, Structure, Vocabulary, Fluency, Comprehension, and Interactions.
    
    # SCENARIO: ${scenario.title} (${scenario.category || 'General'})
    - Phase: ${scenario.phase}
    - Weather: ${scenario.weather}
    - Details: ${scenario.details}
    - Callsign: "${scenario.callsign}"

    ${environmentContext}

    # INTERACTION GUIDELINES (DYNAMIC TRAINING):
    1. **Complexity Scaling**:
       - If the user answers correctly and quickly -> **Increase WPM** and add background "Static/Noise" descriptions in your speech (e.g., "[Static]... report passing... [Static]").
       - If the user struggles or says "Say again" -> **Slow down** slightly but **MAINTAIN** the accent features (just articulate better).
    
    2. **Correction Logic**:
       - If the pilot fails to understand a critical number (Heading/Altitude) due to the accent, you must **NOT** drop the accent. 
       - Instead, use the ICAO technique of saying "I say again" and speaking strictly **digit-by-digit**.

    3. **Emergency/Unexpected**:
       - Occasionally inject "Garbled transmission" simulation (e.g., *[Static]... turn left... [Static]... zero five zero*).

    # BEHAVIOR GUIDELINES:
    - **VOICE ACTING**: The ACCENT INSTRUCTION above is CRITICAL. Maintain the persona of a local controller at ${targetCode}.
    - Act strictly as ATC. Do not break character unless strictly necessary (or if acting as COACH).
    - If the user makes a readback error, correct them immediately as a real ATC would ("Negative, [correction]").
    - Introduce realistic pauses, radio static simulation (via speech nuances), and urgency matching the situation.
    - If the user fails to understand twice, use "Plain English" to clarify, but mark it as a vocabulary/comprehension issue.
    `;

    // UPDATED LOGIC: Even if a custom instruction is provided (e.g. Training Mode),
    // we MUST prepend the dynamic environment context (Airport/Accent/Difficulty)
    // to ensure the accent works correctly.
    const finalInstruction = customSystemInstruction 
        ? `${environmentContext}\n\n${customSystemInstruction}` 
        : baseInstruction;

    try {
        console.log("Initializing Gemini Live Session...");
        this.sessionPromise = this.ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025', 
          callbacks: {
            onopen: () => {
                console.log("Gemini Live Session Opened (Callback)");
                callbacks.onOpen();
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === 'reportAssessment') {
                    const rawData = fc.args;
                    const data = safeParseAssessment(rawData);
                    callbacks.onAssessment(data);
                    this.sessionPromise?.then((session) => {
                      session.sendToolResponse({
                        functionResponses: {
                          id: fc.id,
                          name: fc.name,
                          response: { result: "Report Generated" }
                        }
                      });
                    });
                  }
                }
              }

              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio && this.outputAudioContext) {
                if (this.outputAudioContext.state === 'suspended') {
                     await this.outputAudioContext.resume().catch(e => console.warn("Failed to resume audio ctx", e));
                }

                this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  base64ToBytes(base64Audio),
                  this.outputAudioContext,
                  24000,
                  1
                );
                
                const channelData = audioBuffer.getChannelData(0);
                let sum = 0;
                const step = Math.floor(channelData.length / 50) || 1;
                for (let i = 0; i < channelData.length; i += step) {
                  sum += channelData[i] * channelData[i];
                }
                const rms = Math.sqrt(sum / (channelData.length / step));
                const visualLevel = Math.min(1, rms * 8);
                
                callbacks.onAudioData(visualLevel);

                const source = this.outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                source.addEventListener('ended', () => {
                  this.sources.delete(source);
                  if (this.sources.size === 0) callbacks.onAudioData(0);
                });
                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
              }

              const inputTranscript = message.serverContent?.inputTranscription?.text;
              if (inputTranscript) {
                  this.currentInputPart += inputTranscript; 
                  callbacks.onTranscript(inputTranscript, 'user', true);
              }

              const outputTranscript = message.serverContent?.outputTranscription?.text;
              if (outputTranscript) {
                  if (this.currentInputPart.trim()) {
                      this.fullTranscript += `User: ${this.currentInputPart.trim()}\n`;
                      this.currentInputPart = "";
                  }
                  
                  this.fullTranscript += `ATC: ${outputTranscript}\n`;
                  callbacks.onTranscript(outputTranscript, 'ai', false);
              }

              if (message.serverContent?.turnComplete) {
                if (this.currentInputPart.trim()) {
                    this.fullTranscript += `User: ${this.currentInputPart.trim()}\n`;
                    this.currentInputPart = "";
                }
                callbacks.onTurnComplete();
                callbacks.onTranscript("", 'user', false);
              }
            },
            onclose: () => {
                console.log("Gemini Live Session Closed (Callback)");
                callbacks.onClose();
            },
            onerror: (e: any) => {
              console.error("Gemini Live API Error (Callback):", e);
              const msg = e.message || "Connection Interrupted";
              callbacks.onError(new Error(msg));
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
            },
            inputAudioTranscription: {}, 
            outputAudioTranscription: {},
            systemInstruction: finalInstruction,
            tools: tools,
          },
        });

        await this.sessionPromise;
        this.startAudioInputStream();

    } catch (e: any) {
        console.error("Failed to initialize session:", e);
        callbacks.onError(new Error(e.message || "Failed to initialize session. Check API Key."));
    }
  }

  private startAudioInputStream() {
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    const currentSampleRate = this.inputAudioContext.sampleRate;
    const mimeType = 'audio/pcm;rate=16000';

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      let dataToProcess = inputData;

      if (this.isInputMuted) {
          dataToProcess = new Float32Array(inputData.length).fill(0);
      }
      
      const downsampledData = downsampleTo16k(dataToProcess, currentSampleRate);
      
      const base64Data = this.float32ToBase64(downsampledData);
      
      this.sessionPromise?.then((session) => {
        if (typeof session.sendRealtimeInput === 'function') {
            session.sendRealtimeInput({
                media: {
                    mimeType: mimeType,
                    data: base64Data
                },
            });
        }
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  async sendText(text: string) {
    if (this.sessionPromise) {
        try {
            const session = await this.sessionPromise;
            if (typeof session.send === 'function') {
                await session.send({ parts: [{ text: text }] });
            } else {
                console.warn("session.send not supported for text input.");
            }
        } catch(e) {
            console.error("Failed to send text", e);
        }
    }
  }

  // --- NEW FINALIZE STRATEGY ---
  async finalize() {
    console.log("Finalizing session...");
    this.setInputMuted(true); 
    
    console.log("Waiting for trailing transcripts (buffer period)...");
    await new Promise(resolve => setTimeout(resolve, 2000)); 

    if (this.currentInputPart.trim()) {
        this.fullTranscript += `User: ${this.currentInputPart.trim()}\n`;
        this.currentInputPart = "";
    }

    await this.disconnect();

    if (this.currentCallbacks && this.ai) {
        console.log("Full Transcript for Assessment:", this.fullTranscript);

        if (!this.fullTranscript.trim() || this.fullTranscript.length < 15) {
             console.warn("Transcript too short for assessment.");
             this.currentCallbacks.onAssessment(safeParseAssessment({
                 overallScore: 1,
                 executiveSummary: { 
                     assessment: "Audio processing error: No valid speech detected. This may be due to microphone permissions, network issues, or the session was too short.", 
                     safetyMargin: "N/A", 
                     frictionPoints: "No audio received." 
                 }
             }));
            return;
        }

        try {
            console.log("Generating assessment report using Gemini 3 Pro...");
            const model = this.ai.models;
            
            const prompt = `
            # ROLE: ICAO English Master Examiner
            # TASK: Assess the following radiotelephony transcript and generate a JSON report.
            
            # SCENARIO CONTEXT (THE "GROUND TRUTH"):
            - Scenario Title: ${this.scenarioContext?.title}
            - Situation Details: ${this.scenarioContext?.details}
            - Weather Conditions: ${this.scenarioContext?.weather}
            - Callsign: ${this.scenarioContext?.callsign}
            - Flight Phase: ${this.scenarioContext?.phase}
            
            # TRANSCRIPT (ACTUAL PERFORMANCE):
            ${this.fullTranscript}
            
            # ASSESSMENT GUIDELINES:
            1. **FACTUAL ACCURACY CHECK (CRITICAL)**: 
               - Compare the transcript against the SCENARIO CONTEXT.
               - Did the pilot correctly read back numbers (headings, altitudes, QNH)? 
               - Did they follow the specific instructions implied by the scenario?
               - **RULE:** If the pilot made a factual error (e.g., wrong turn direction, wrong altitude) that affects safety, the score MUST be 3 or lower, regardless of grammar.
               
            2. **FORENSIC LINGUISTICS**: 
               - Quote specific words the user said in the 'deepAnalysis' section.
            
            3. **SCORING**: Use the ICAO holistic descriptors (1-6).
               - Level 6: Native-like, nuance, no errors.
               - Level 4: Operational, some errors but safe.
               - Level 3: Frequent errors, misunderstandings, safety risk.
            
            # DEEP ANALYSIS INSTRUCTIONS:
            - Identify 3-5 specific moments where the user's speech could be improved.
            - CATEGORIZE EACH ERROR: [STRUCTURE], [PRONUNCIATION], [VOCABULARY], [FLUENCY], [COMPREHENSION-FACTUAL].
            - Example:
              {
                "context": "User: Turning right heading 180.",
                "issue": "[COMPREHENSION-FACTUAL] Wrong direction",
                "correction": "Turn left heading 180",
                "theory": "User failed to comprehend the directional instruction from ATC, posing a collision risk."
              }
            
            # JSON FORMAT:
            - Strict JSON. No markdown code blocks.
            - All explanations in SIMPLIFIED CHINESE (简体中文).
            `;

            const response = await model.generateContent({
                model: 'gemini-3-pro-preview',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: assessmentSchema
                }
            });

            const jsonText = response.text;
            if (jsonText) {
                try {
                    const cleanedJson = cleanJsonOutput(jsonText);
                    const parsed = JSON.parse(cleanedJson);
                    const safeData = safeParseAssessment(parsed);
                    this.currentCallbacks.onAssessment(safeData);
                } catch (parseError) {
                    console.error("JSON Parse Error:", parseError, "Raw Text:", jsonText);
                    // Fallback to a partial report or error state
                     this.currentCallbacks.onAssessment(safeParseAssessment({
                        executiveSummary: { 
                            assessment: "AI 评估报告生成格式错误，无法解析。请重试。(JSON Parse Failed)", 
                            safetyMargin: "Unknown", 
                            frictionPoints: "System Error" 
                        },
                        feedback: jsonText // Return raw text so user might see something
                    }));
                }
            } else {
                throw new Error("Empty response from assessment model.");
            }

        } catch (e) {
            console.error("Report generation failed:", e);
            this.currentCallbacks.onAssessment(safeParseAssessment({
                executiveSummary: { assessment: "Report generation failed due to network or model error.", safetyMargin: "N/A", frictionPoints: "N/A" }
            }));
        }
    }
  }

  async disconnect() {
    console.log("Disconnecting Live Client...");
    this.stopCockpitNoise();

    if (this.sessionPromise) {
        try {
            const session = await this.sessionPromise;
            session.close();
        } catch (e) {
            console.warn("Failed to close session cleanly:", e);
        }
        this.sessionPromise = null;
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.inputSource) {
        this.inputSource.disconnect();
        this.inputSource = null;
    }
    
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
       try { await this.inputAudioContext.close(); } catch(e) {}
       this.inputAudioContext = null;
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
       try { await this.outputAudioContext.close(); } catch(e) {}
       this.outputAudioContext = null;
    }
    
    this.sources.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    this.sources.clear();
  }

  private float32ToBase64(buffer: Float32Array): string {
    const l = buffer.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    let binary = '';
    const bytes = new Uint8Array(int16.buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
