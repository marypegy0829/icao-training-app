
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { Scenario, AppLanguage } from "../types";
import { createPcmBlob, decodeAudioData, normalizeAudio } from "./audioUtils";
import { airportService } from "./airportService";
import { configService } from "./configService";

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
  private client: GoogleGenAI | null = null;
  private sessionPromise: Promise<any> | null = null;
  
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  
  // Audio State Tracking
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  
  public isRecording = false;
  public isBufferedMode = false;
  private isInputMuted = false;
  private audioBufferQueue: Float32Array[] = [];
  
  // Power Saving
  private suspendTimer: any = null;
  
  private callbacks: LiveClientCallbacks | null = null;

  constructor() {
    // Hidden Design: Do NOT initialize client here with hardcoded env vars.
    // Initialization happens in connect() after fetching key dynamically.
  }

  // --- REGION 1: ACCENT & VOICE LOGIC ---

  private getVoiceName(airportCode: string, enabled: boolean): string {
      // Default / Standard voice
      if (!enabled || !airportCode || airportCode.length < 2) return 'Kore';

      const code = airportCode.toUpperCase();
      const prefix = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);

      // 1. Deep / Authoritative Male Voices (Fenrir)
      // Suitable for: Mainland China (Z), SE Asia (V), Russia (U)
      if (['Z', 'V', 'U'].includes(prefix1)) {
          return 'Fenrir';
      }

      // 2. Standard Deep Male (Charon)
      // Suitable for: Korea (RK), Japan (RJ), Middle East (O), Europe (E, L), South America (S)
      if (prefix === 'RK' || prefix === 'RJ' || ['O', 'E', 'L', 'S', 'F', 'H', 'G', 'D'].includes(prefix1)) {
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

  /**
   * Generates the Voice Style, Speed, and Accent instruction based on Difficulty Level.
   */
  private getAccentInstruction(airportCode: string, enabled: boolean, difficulty: string): string {
      const code = airportCode ? airportCode.toUpperCase() : 'XXXX';
      const prefix = code.substring(0, 2);
      const prefix1 = code.substring(0, 1);

      // 1. Determine Difficulty Parameters
      let speedInstruction = "";
      let clarityInstruction = "";
      let accentIntensity = "";

      if (difficulty.includes("Level 3")) {
          // LEVEL 3-4
          speedInstruction = "**SPEAKING RATE**: SLOW (approx 90-100 WPM). Leave distinct pauses.";
          clarityInstruction = "**ARTICULATION**: TEXTBOOK PERFECT. Enunciate every syllable.";
          accentIntensity = "NEUTRAL / STANDARD ICAO. Suppress regional accents.";
      } else if (difficulty.includes("Recurrent")) {
          // LEVEL 4
          speedInstruction = "**SPEAKING RATE**: NORMAL / STANDARD (approx 115-125 WPM).";
          clarityInstruction = "**ARTICULATION**: Professional and clear.";
          accentIntensity = enabled ? "DISTINCT REGIONAL ACCENT. Authentic but intelligible." : "STANDARD ICAO.";
      } else if (difficulty.includes("Level 4 → 5")) {
          // LEVEL 5
          speedInstruction = "**SPEAKING RATE**: FAST (approx 135-145 WPM). Efficient delivery.";
          clarityInstruction = "**ARTICULATION**: Natural flow. Use standard contractions/reductions.";
          accentIntensity = enabled ? "MODERATE-HEAVY REGIONAL ACCENT. Authentic local intonation." : "MILDLY BUSY TONE.";
      } else {
          // LEVEL 6
          speedInstruction = "**SPEAKING RATE**: VERY FAST / BUSY (150+ WPM). Rapid-fire delivery.";
          clarityInstruction = "**ARTICULATION**: Clipped, hurried, 'Radio Voice'.";
          accentIntensity = "HEAVY / AUTHENTIC LOCAL ACCENT. Challenge the pilot's ear.";
      }

      // 2. Generate Base Instruction
      const base = `
### 🎙️ VOICE & PERSONA CONFIGURATION
- **ROLE**: Busy ATC Controller at ${code}.
- ${speedInstruction}
- ${clarityInstruction}
- **ACCENT INTENSITY**: ${accentIntensity}
`;

      if ((!enabled && !difficulty.includes("Level 6")) || difficulty.includes("Level 3")) {
          return `${base}\n- **STYLE**: Use Standard ICAO English. Neutral and clear.`;
      }

      // 3. Region Specific Instructions
      let regionSpecifics = "";

      if (prefix1 === 'Z') { // China
          regionSpecifics = `
### **🌏 REGION Z (China) - "Beijing/Shanghai Control"**
* **Phonology**: /θ/ -> /s/ (Three -> Sree), /v/ -> /w/. Final consonants often swallowed.
* **Prosody**: Staccato rhythm. High volume. Authoritative.`;
      }
      else if (prefix === 'RK') { // Korea
          regionSpecifics = `
### **🌏 REGION RK (Korea) - "Incheon Control"**
* **ACTING**: Distinct Korean accent.
* **Phonology**: Substitute 'F' with 'P' (Frequency -> Prequency). Substitute 'R'/'L'.
* **Prosody**: Syllable-timed. Rising intonation at end.`;
      }
      else if (prefix1 === 'V') { // India / SE Asia
          regionSpecifics = `
### **🌏 REGION V (India/Thailand)**
* **Phonology**: Retroflex T/D. W/V merger.
* **Prosody**: Musical/Sing-song rhythm. Very fast pace.`;
      }
      else if (prefix === 'RJ' || prefix === 'RO') { // Japan
          regionSpecifics = `
### **🌏 REGION RJ (Japan)**
* **Phonology**: Katakana effect (Street -> Sutorito).
* **Prosody**: Monotonic, flat rhythm, robot-like precision.`;
      }
      else if (prefix1 === 'O' || ['HE', 'HA', 'DT', 'DA'].includes(prefix)) { // Middle East
          regionSpecifics = `
### **🌏 REGION O/H (Middle East)**
* **Phonology**: Guttural /h/ and /k/. P/B confusion (Parking -> Barking). Trilled R.`;
      }
      else if (prefix1 === 'S' || prefix1 === 'M') { // Latin America
          regionSpecifics = `
### **🌎 REGION S/M (Latin America)**
* **Phonology**: Vowel insertion before S-clusters (Station -> E-station). H is silent.
* **Prosody**: Rapid machine-gun rhythm.`;
      }
      else if (prefix1 === 'U') { // Russia
          regionSpecifics = `
### **🌏 REGION U (Russia)**
* **Phonology**: No /th/ sound (Three -> Tree). Rolling R. Heavy articulation.
* **Prosody**: Falling intonation. Serious tone.`;
      }
      else if (prefix === 'LF') { // France
          regionSpecifics = `
### **🌏 REGION E (France)**
* **Phonology**: H-dropping. Th -> Z. Uvular R.`;
      }
      
      if (!regionSpecifics && (enabled || difficulty.includes("Level 6"))) {
          regionSpecifics = `- **STYLE**: Use a slight regional touch appropriate for ${code}.`;
      }

      return `${base}\n${regionSpecifics}`;
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

    // --- KEY FETCHING LOGIC (HIDDEN DESIGN) ---
    // 1. Try Config Service (DB or Env)
    let apiKey = await configService.getGoogleApiKey();
    let source = "Database";
    
    if (!apiKey || apiKey.includes("YOUR_ACTUAL_GEMINI_KEY")) {
        console.warn("LiveClient: Invalid Key from ConfigService, checking process.env fallback.");
        // 2. Final Fallback to process.env directly (if configService failed)
        apiKey = process.env.API_KEY;
        source = "Environment (.env)";
    }

    if (!apiKey) {
        const msg = "API Key Missing. Please check .env file or Supabase config.";
        console.error(msg);
        this.callbacks?.onError(new Error(msg));
        return;
    }

    // DEBUG: Verify Key Prefix
    const maskedKey = apiKey.substring(0, 8) + '...';
    console.log(`LiveClient: Connecting using API Key from ${source} (${maskedKey})`);

    // Initialize Client with resolved key
    this.client = new GoogleGenAI({ apiKey });

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
                const rwList = airport.runways ? airport.runways.join(', ') : 'Standard';
                let freqList = "";
                if (airport.frequencies) {
                    freqList = Object.entries(airport.frequencies)
                        .map(([k, v]) => `- ${k}: ${v} MHz`)
                        .join('\n');
                } else {
                    freqList = "- TOWER: 118.100 MHz\n- GROUND: 121.900 MHz\n- APP: 119.700 MHz";
                }
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
    Adapt scenario runway/taxiways to REAL data from ${airport.icao_code} above.
    Maintain core conflict but map to correct geometry.
    `;
            }
        } catch (e) {
            console.warn("LiveClient: Failed to load airport data", e);
        }
    }

    // 2. Generate Voice & Accent Config
    const voiceName = this.getVoiceName(airportCode, accentEnabled);
    const accentPrompt = this.getAccentInstruction(airportCode, accentEnabled, difficulty);

    // 3. Language & Reporting Instruction
    const langInstruction = language === 'cn' 
        ? `
        *** REPORTING LANGUAGE CONFIGURATION ***
        When calling 'reportAssessment', WRITE 'assessment', 'safetyMargin', 'frictionPoints', 'theory', 'rootCause', and 'explanation' in SIMPLIFIED CHINESE.
        KEEP quotes/transcripts in ENGLISH.
        `
        : `
        *** REPORTING LANGUAGE CONFIGURATION ***
        All content in 'reportAssessment' MUST be in ENGLISH.
        `;

    // 4. Build System Instruction
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

    let currentInputTranscription = "";

    const config = {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemInstruction,
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
            },
            inputAudioTranscription: {}, 
            outputAudioTranscription: {}, 
            tools: [{ functionDeclarations: [assessmentTool] }],
        },
        callbacks: {
            onopen: () => {
                console.log("LiveClient: Connection opened");
                this.initAudioInputStream();
                this.callbacks?.onOpen();
            },
            onmessage: async (message: LiveServerMessage) => {
                // 1. Handle Tool Calls
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
                if (message.serverContent?.inputTranscription) {
                    const text = message.serverContent.inputTranscription.text;
                    if (text) {
                        currentInputTranscription += text;
                        this.callbacks?.onTranscript(currentInputTranscription, 'user', true);
                    }
                }
                
                if (message.serverContent?.outputTranscription) {
                    const text = message.serverContent.outputTranscription.text;
                    if (text) {
                        this.callbacks?.onTranscript(text, 'ai', false); 
                    }
                }

                // 4. Turn Complete
                if (message.serverContent?.turnComplete) {
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
                let msg = err.message || "Unknown Connection Error";
                // Friendly error for Leaked Keys / 403
                if (
                    msg.includes("403") || 
                    msg.includes("API key") || 
                    msg.includes("leaked") ||
                    msg.includes("expired")
                ) {
                    msg = `API Key Error: Key is invalid/LEAKED (${maskedKey}). Please restart 'npm run dev'.`;
                }
                console.error("LiveClient: Error", err);
                this.callbacks?.onError(new Error(msg));
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
        // --- SECURITY CHECK: Microphone requires HTTPS or Localhost ---
        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            throw new Error("SECURE CONTEXT REQUIRED: Microphone access is blocked on HTTP. Please use localhost or enable HTTPS.");
        }

        this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        if (!this.inputAudioContext) return;

        this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
        this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

        this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            
            // Calculate Audio Level
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            this.callbacks?.onAudioData(rms * 5); 

            // Logic: Muted / PTT
            if (this.isInputMuted && !this.isRecording) {
                return; // Drop data
            }

            // Logic: Software Gating (Half-Duplex)
            if (this.outputAudioContext) {
                const isAiSpeaking = this.outputAudioContext.currentTime < (this.nextStartTime + 0.5); 
                if (isAiSpeaking) {
                    return; 
                }
            }

            this.sendRealtimeInput(inputData);
        };

        this.inputSource.connect(this.processor);
        this.processor.connect(this.inputAudioContext.destination);

    } catch (e: any) {
        console.error("Microphone initialization failed", e);
        let msg = e.message;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            msg = "Microphone permission denied. Please click the lock icon in the URL bar to allow access.";
        } else if (e.name === 'NotFoundError') {
            msg = "No microphone found on this device.";
        } else if (msg.includes("not allowed by the user agent")) {
            msg = "Microphone access blocked by browser policy. If testing on mobile, ensure you are using HTTPS.";
        }
        this.callbacks?.onError(new Error(msg));
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

        source.onended = () => {
            this.activeSources = this.activeSources.filter(s => s !== source);
        };
        this.activeSources.push(source);

        const now = this.outputAudioContext.currentTime;
        const startTime = Math.max(this.nextStartTime, now);
        source.start(startTime);
        
        this.nextStartTime = startTime + buffer.duration;

    } catch (e) {
        console.error("Audio playback error", e);
    }
  }

  cancelOutput() {
      this.activeSources.forEach(s => {
          try { s.stop(); } catch(e) { /* ignore */ }
      });
      this.activeSources = [];
      if (this.outputAudioContext) {
          this.nextStartTime = this.outputAudioContext.currentTime;
      }
  }

  async startRecording() {
      if (this.suspendTimer) {
          clearTimeout(this.suspendTimer);
          this.suspendTimer = null;
      }

      if (this.inputAudioContext && this.inputAudioContext.state === 'suspended') {
          try {
              await this.inputAudioContext.resume();
          } catch (e) {
              console.warn("Failed to resume input context:", e);
          }
      }

      this.cancelOutput();

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

      if (this.inputAudioContext && this.inputAudioContext.state === 'running') {
          this.suspendTimer = setTimeout(async () => {
              if (!this.isRecording && this.inputAudioContext?.state === 'running') {
                  try {
                      await this.inputAudioContext.suspend();
                  } catch (e) { /* ignore */ }
              }
          }, 5000); 
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
      this.cancelOutput(); 
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
      this.client = null;
  }
}
