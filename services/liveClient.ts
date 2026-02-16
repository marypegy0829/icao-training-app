
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Scenario, AppLanguage } from "../types";
import { createPcmBlob, decodeAudioData, normalizeAudio } from "./audioUtils";
import { airportService } from "./airportService";

interface LiveClientCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Error) => void;
  onAudioData: (level: number) => void;
  onTurnComplete: () => void;
  onTranscript: (text: string, role: 'user' | 'ai', isPartial: boolean) => void;
  onAssessment: (data: any) => void;
}

const assessmentTool: FunctionDeclaration = {
  name: "reportAssessment",
  description: "Report the ICAO English assessment results for the pilot trainee.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      overallScore: { type: Type.NUMBER, description: "Overall ICAO score (1-6)" },
      pronunciation: { type: Type.NUMBER, description: "Score 1-6" },
      structure: { type: Type.NUMBER, description: "Score 1-6" },
      vocabulary: { type: Type.NUMBER, description: "Score 1-6" },
      fluency: { type: Type.NUMBER, description: "Score 1-6" },
      comprehension: { type: Type.NUMBER, description: "Score 1-6" },
      interactions: { type: Type.NUMBER, description: "Score 1-6" },
      executiveSummary: {
        type: Type.OBJECT,
        properties: {
          assessment: { type: Type.STRING },
          safetyMargin: { type: Type.STRING },
          frictionPoints: { type: Type.STRING }
        }
      },
      dimensionalDetails: {
        type: Type.OBJECT,
        properties: {
          pronunciation: { type: Type.STRING },
          structure: { type: Type.STRING },
          vocabulary: { type: Type.STRING },
          fluency: { type: Type.STRING },
          comprehension: { type: Type.STRING },
          interactions: { type: Type.STRING }
        }
      },
      deepAnalysis: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
             context: { type: Type.STRING },
             issue: { type: Type.STRING },
             theory: { type: Type.STRING },
             rootCause: { type: Type.STRING },
             correction: { type: Type.STRING }
          }
        }
      },
      remedialPlan: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    },
    required: ["overallScore", "pronunciation", "structure", "vocabulary", "fluency", "comprehension", "interactions"]
  }
};

export class LiveClient {
  private client: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private nextStartTime = 0;
  
  public isRecording = false;
  public isBufferedMode = false;
  private isInputMuted = false;
  private audioBufferQueue: Float32Array[] = [];
  
  // Power Saving
  private suspendTimer: any = null;
  
  private callbacks: LiveClientCallbacks | null = null;

  constructor() {
    // API Key is strictly obtained from process.env.API_KEY
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // --- REGION 1: ACCENT & VOICE LOGIC ---

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

  private getAccentInstruction(airportCode: string, enabled: boolean): string {
      if (!enabled || !airportCode || airportCode.length < 2) {
          return "- **ACCENT**: Use Standard ICAO English / Generic US/UK Accent. Clear and Neutral.";
      }

      const code = airportCode.toUpperCase();
      const prefix = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);

      const base = `
!!! CRITICAL VOICE ACTING INSTRUCTION !!!
ACT AS A LOCAL ATC CONTROLLER AT ${code}. IMPERSONATE THE ACCENT DESCRIBED BELOW.
DO NOT speak like a generic AI robot. Be human, busy, and professional.
`;

      // --- ASIA ---
      if (prefix1 === 'Z') { // China
          return `${base}
### **🌏 REGION Z (China) - "Beijing/Shanghai Control"**
* **Phonology**: /θ/ -> /s/ (Three -> Sree), /v/ -> /w/. Final consonants often swallowed.
* **Prosody**: Staccato rhythm. High volume. Authoritative but slightly rigid.
* **Lexical**: Strict use of "DAY-SEE-MAL", "Standby".
* **Example**: "Air China 981, radar contact. Turn right heading 090. Descend now."`;
      }
      if (prefix === 'RK') { // Korea
          return `${base}
### **🌏 REGION RK (Korea) - "Incheon Control"**
* **Phonology**: P/F merger (Frequency -> Prequency). R/L liquid sound.
* **Prosody**: Syllable-timed. distinct high-low-high pitch at end of phrases.
* **Example**: "Korean Air 85, change prequency one two one DAY-SEE-MAL pipe."`;
      }
      if (prefix1 === 'V') { // India / SE Asia
          return `${base}
### **🌏 REGION V (India/Thailand) - "Mumbai/Bangkok Control"**
* **Phonology**: Retroflex T/D (curled tongue). W/V merger.
* **Prosody**: Musical/Sing-song rhythm. Very fast pace (130+ WPM).
* **Lexical**: "Confirm" used often.
* **Example**: "Vistara 202, confirm visual? Do one thing, descend level eight zero."`;
      }
      if (prefix === 'RJ' || prefix === 'RO') { // Japan
          return `${base}
### **🌏 REGION RJ (Japan) - "Tokyo Control"**
* **Phonology**: Katakana effect (Street -> Sutorito). R/L merger.
* **Prosody**: Monotonic, flat rhythm, robot-like precision. Very polite.
* **Example**: "All Nippon 5, rradar contact. Prease cimb and maintain."`;
      }

      // --- MIDDLE EAST & AFRICA ---
      if (prefix1 === 'O' || ['HE', 'HA', 'DT', 'DA'].includes(prefix)) { // Middle East
          return `${base}
### **🌏 REGION O/H (Middle East) - "Dubai/Cairo Control"**
* **Phonology**: Guttural /h/ and /k/. P/B confusion (Parking -> Barking). Trilled R.
* **Prosody**: Deep, resonant, deliberate pace.
* **Lexical**: Formal address ("Captain").
* **Example**: "Emirates 5, cleared to rand runway one two reft. Contact ground."`;
      }

      // --- SOUTH AMERICA ---
      if (prefix1 === 'S' || prefix1 === 'M') { // Latin America
          return `${base}
### **🌎 REGION S/M (Latin America) - "Bogota/Sao Paulo/Mexico"**
* **Phonology**: Vowel insertion before S-clusters (Station -> E-station). H is silent.
* **Prosody**: Rapid machine-gun rhythm. Spanish-influenced cadence.
* **Example**: "Avianca 5, turn left, e-speed one eight zero. Contact e-tower."`;
      }

      // --- RUSSIA ---
      if (prefix1 === 'U') { // Russia
          return `${base}
### **🌏 REGION U (Russia) - "Moscow Control"**
* **Phonology**: No /th/ sound (Three -> Tree/Zree). Rolling R. Heavy articulation.
* **Prosody**: Falling intonation. Serious, somber tone.
* **Example**: "Aeroflot 101, descend level tree-zero-zero. Position check."`;
      }

      // --- EUROPE ---
      if (prefix === 'LF') { // France
          return `${base}
### **🌏 REGION E (France) - "Paris Control"**
* **Phonology**: H-dropping ('Eading). Th -> Z (The -> Ze). Uvular R.
* **Prosody**: Stress on last syllable.
* **Example**: "Air France 44, turn left 'eading tree-six-zero. Descend."`;
      }
      
      return "- **ACCENT**: Use Standard ICAO English with a slight regional touch appropriate for the location.";
  }

  async connect(
    scenario: Scenario,
    callbacks: LiveClientCallbacks,
    difficulty: string,
    airportCode: string,
    accentEnabled: boolean,
    cockpitNoise: boolean,
    coachingInstruction: string,
    dynamicRules: string,
    language: AppLanguage = 'cn'
  ) {
    this.callbacks = callbacks;

    // Audio Context Setup
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);

    // 1. Fetch Dynamic Airport Data for Adaptation
    let airportContext = "";
    if (airportCode && airportCode.length >= 3) {
        try {
            const airport = await airportService.getAirportByCode(airportCode);
            if (airport) {
                // Construct a rich context block for the AI
                const rwList = airport.runways ? airport.runways.join(', ') : 'Standard';
                
                // Format Frequencies for AI Prompt
                let freqList = "";
                if (airport.frequencies) {
                    freqList = Object.entries(airport.frequencies)
                        .map(([k, v]) => `- ${k}: ${v} MHz`)
                        .join('\n');
                } else {
                    freqList = "- TOWER: 118.100 MHz\n- GROUND: 121.900 MHz\n- APP: 119.700 MHz";
                }

                // Format Procedures
                let procList = "Standard Procedures";
                if (airport.procedures) {
                    const sids = airport.procedures.sids ? `SIDs: ${airport.procedures.sids.join(', ')}` : '';
                    const stars = airport.procedures.stars ? `STARs: ${airport.procedures.stars.join(', ')}` : '';
                    procList = `${sids}\n${stars}`;
                }
                
                airportContext = `
    ### 🏟️ ACTIVE AIRPORT ENVIRONMENT: ${airport.name} (${airport.icao_code})
    - Elevation: ${airport.elevation_ft}ft
    - Runways: ${rwList}
    
    ### 📡 ACTIVE FREQUENCIES (ROLEPLAY THESE UNITS):
    ${freqList}
    
    ### 🛫 PROCEDURES:
    ${procList}
    
    ⚠️ **SCENARIO ADAPTATION REQUIRED**:
    The scenario details provided may use generic or incorrect runway/taxiway designators (e.g. "36R", "Alpha").
    YOU MUST ADAPT the scenario to use REAL runways and taxiways from the ${airport.icao_code} data above.
    Example: If scenario says "Taxi to 36R" but ${airport.icao_code} only has "09/27", clear the pilot to "Runway 27" instead.
    MAINTAIN THE CORE CONFLICT (e.g. Incursion, Fire) but place it in the correct GEOMETRY.
    USE CORRECT UNIT NAMES (e.g., "${airport.city} Tower" instead of "Tower").
    `;
            }
        } catch (e) {
            console.warn("LiveClient: Failed to load airport data for context injection", e);
        }
    }

    // 2. Generate Voice & Accent Config
    const voiceName = this.getVoiceName(airportCode, accentEnabled);
    const accentPrompt = this.getAccentInstruction(airportCode, accentEnabled);

    // 3. Language & Reporting Instruction
    const langInstruction = language === 'cn' 
        ? `
        *** REPORTING LANGUAGE CONFIGURATION (IMPORTANT) ***
        When calling 'reportAssessment' tool, YOU MUST:
        1. Write the 'assessment', 'safetyMargin', 'frictionPoints', 'theory', 'rootCause', and 'explanation' fields in SIMPLIFIED CHINESE (简体中文).
        2. KEEP any direct quotes, transcripts, or specific aviation phraseology examples in ENGLISH.
        3. The goal is to explain the concepts to a Chinese speaker, but show the English mistakes clearly.
        `
        : `
        *** REPORTING LANGUAGE CONFIGURATION ***
        All content in 'reportAssessment' MUST be in ENGLISH.
        `;

    // 4. Build System Instruction with all contexts
    const systemInstruction = `
    ${coachingInstruction}
    
    # ENVIRONMENT CONFIGURATION
    - Current Difficulty: ${difficulty}
    - Airport: ${airportCode}
    - Cockpit Noise Sim: ${cockpitNoise ? "ENABLED" : "DISABLED"}
    - App Language: ${language === 'cn' ? 'Chinese' : 'English'}
    
    ${airportContext}

    ${accentPrompt}

    ${dynamicRules}

    ${langInstruction}
    `;

    // Local accumulation for transcripts
    let currentInputTranscription = "";

    const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: {
                // Dynamically set the voice based on region
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
            },
            inputAudioTranscription: {}, // Enable Input Transcription
            outputAudioTranscription: {}, // Enable Output Transcription
            tools: [{ functionDeclarations: [assessmentTool] }],
        },
        callbacks: {
            onopen: () => {
                console.log("LiveClient: Connection opened");
                this.initAudioInputStream();
                this.callbacks?.onOpen();
            },
            onmessage: async (message: LiveServerMessage) => {
                // 1. Handle Tool Calls (Assessment)
                if (message.toolCall) {
                    console.log("Tool Call Received:", message.toolCall);
                    for (const fc of message.toolCall.functionCalls) {
                        if (fc.name === 'reportAssessment') {
                            this.callbacks?.onAssessment(fc.args);
                            this.sessionPromise?.then(session => {
                                session.sendToolResponse({
                                    functionResponses: {
                                        id: fc.id,
                                        name: fc.name,
                                        response: { result: "Assessment Received" }
                                    }
                                });
                            });
                        }
                    }
                }

                // 2. Handle Audio Output
                const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audioData) {
                    this.playAudio(audioData);
                }

                // 3. Handle Transcript
                // Input (User)
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    if (text) {
                        currentInputTranscription += text;
                        this.callbacks?.onTranscript(currentInputTranscription, 'user', true);
                    }
                }
                
                // Output (Model)
                if (message.serverContent?.outputTranscription) {
                    const text = message.serverContent.outputTranscription.text;
                    if (text) {
                        this.callbacks?.onTranscript(text, 'ai', false); // AI chunks are appended by frontend logic
                    }
                }

                // 4. Handle Turn Complete
                if (message.serverContent?.turnComplete) {
                    // Finalize user input state
                    if (currentInputTranscription) {
                        this.callbacks?.onTranscript(currentInputTranscription, 'user', false);
                        currentInputTranscription = "";
                    }
                    this.callbacks?.onTurnComplete();
                }
            },
            onclose: () => {
                console.log("LiveClient: Connection closed");
                this.callbacks?.onClose();
            },
            onerror: (err: any) => {
                console.error("LiveClient: Error", err);
                this.callbacks?.onError(err);
            }
        }
    };

    try {
        // @ts-ignore
        this.sessionPromise = this.client.live.connect(config);
    } catch (e) {
        console.error("Failed to connect to Live API", e);
        this.callbacks?.onError(e as Error);
    }
  }

  private async initAudioInputStream() {
    try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!this.inputAudioContext) return;

        this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
        this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate Audio Level for Visualizer
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            this.callbacks?.onAudioData(rms * 5); 

            // Logic: Muted / PTT / Open Mic
            if (this.isInputMuted && !this.isRecording) {
                return; // Drop data
            }

            // REVERTED VAD OPTIMIZATION: Send data continuously if not muted
            // This ensures no speech is cut off due to aggressive silence detection thresholds
            this.sendRealtimeInput(inputData);
        };

        this.inputSource.connect(this.processor);
        this.processor.connect(this.inputAudioContext.destination);

    } catch (e) {
        console.error("Microphone initialization failed", e);
        this.callbacks?.onError(e as Error);
    }
  }

  private sendRealtimeInput(data: Float32Array) {
      const normalizedData = normalizeAudio(data);
      const pcmBlob = createPcmBlob(normalizedData);

      this.sessionPromise?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
      });
  }

  private async playAudio(base64Data: string) {
    if (!this.outputAudioContext || !this.outputNode) return;

    try {
        const audioBytes = decodeAudioData(
             new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0))), 
             this.outputAudioContext, 
             24000, 
             1
        );
        
        const buffer = await audioBytes;
        const source = this.outputAudioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.outputNode);

        const now = this.outputAudioContext.currentTime;
        this.nextStartTime = Math.max(this.nextStartTime, now);
        source.start(this.nextStartTime);
        this.nextStartTime += buffer.duration;

    } catch (e) {
        console.error("Audio playback error", e);
    }
  }

  async startRecording() {
      // Clear suspension timer if active
      if (this.suspendTimer) {
          clearTimeout(this.suspendTimer);
          this.suspendTimer = null;
      }

      // Resume AudioContext if suspended (Power Saving)
      if (this.inputAudioContext && this.inputAudioContext.state === 'suspended') {
          try {
              await this.inputAudioContext.resume();
              console.log("AudioContext Resumed");
          } catch (e) {
              console.warn("Failed to resume input context:", e);
          }
      }

      if (this.isBufferedMode) {
          this.isRecording = true;
          this.audioBufferQueue = []; 
      } else {
          this.setInputMuted(false);
      }
  }

  async stopRecording() {
      if (this.isBufferedMode) {
          this.isRecording = false;
      } else {
          this.setInputMuted(true);
      }

      // Schedule AudioContext suspension to save CPU/Battery
      if (this.inputAudioContext && this.inputAudioContext.state === 'running') {
          this.suspendTimer = setTimeout(async () => {
              // Double check status before suspending
              if (!this.isRecording && this.inputAudioContext?.state === 'running') {
                  try {
                      await this.inputAudioContext.suspend();
                      console.log("AudioContext Suspended (Power Saving)");
                  } catch (e) {
                      console.warn("Failed to suspend input context:", e);
                  }
              }
          }, 5000); // Suspend after 5 seconds of silence
      }
  }

  setBufferedMode(enabled: boolean) {
      this.isBufferedMode = enabled;
  }

  setInputMuted(muted: boolean) {
      this.isInputMuted = muted;
  }

  sendText(text: string) {
      this.sessionPromise?.then(session => {
          session.sendRealtimeInput({ text: text });
      });
  }

  async finalize() {
      this.sendText("TERMINATE_SESSION_IMMEDIATELY");
  }

  disconnect() {
      if (this.suspendTimer) clearTimeout(this.suspendTimer);
      
      if (this.processor) {
          this.processor.disconnect();
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
      if (this.inputAudioContext) {
          this.inputAudioContext.close();
          this.inputAudioContext = null;
      }
      if (this.outputAudioContext) {
          this.outputAudioContext.close();
          this.outputAudioContext = null;
      }
      
      this.sessionPromise?.then(session => {
          if (typeof session.close === 'function') {
              session.close();
          }
      });
      this.sessionPromise = null;
  }
}
