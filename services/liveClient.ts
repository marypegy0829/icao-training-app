
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Tool, Schema } from '@google/genai';
import { base64ToBytes, decodeAudioData, downsampleTo16k } from './audioUtils';
import { AssessmentData, Scenario, DifficultyLevel } from '../types';

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

  async connect(scenario: Scenario, callbacks: LiveClientCallbacks, difficulty: DifficultyLevel = DifficultyLevel.LEVEL_4_RECURRENT, customSystemInstruction?: string) {
    // 1. Clean up potential previous sessions or contexts
    await this.disconnect();
    
    this.currentCallbacks = callbacks;
    this.scenarioContext = scenario;
    this.fullTranscript = "";
    this.currentInputPart = "";

    // 2. Initialize Audio Contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    try {
        // We let the system choose the sample rate (usually 44100 or 48000)
        // We will downsample manually to 16000 before sending to Gemini
        this.inputAudioContext = new AudioContextClass();
        
        // Output context for playback (can be higher quality)
        this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    } catch (e) {
        console.warn("Failed to suggest sample rate, falling back to default", e);
        this.inputAudioContext = new AudioContextClass();
        this.outputAudioContext = new AudioContextClass();
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

    // Dynamic Difficulty Instruction
    const difficultyPrompt = this.getDifficultyInstruction(difficulty);

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

    ${difficultyPrompt}

    # BEHAVIOR GUIDELINES:
    - Act strictly as ATC. Do not break character unless strictly necessary (or if acting as COACH).
    - If the user makes a readback error, correct them immediately as a real ATC would ("Negative, [correction]").
    - Introduce realistic pauses, radio static simulation (via speech nuances), and urgency matching the situation.
    - If the user fails to understand twice, use "Plain English" to clarify, but mark it as a vocabulary/comprehension issue.
    `;

    const finalInstruction = customSystemInstruction || baseInstruction;

    // Wrap the connection logic in a try-catch to handle synchronous SDK errors
    try {
        console.log("Initializing Gemini Live Session...");
        // Use Gemini 2.5 Flash Native Audio for the real-time interaction
        this.sessionPromise = this.ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025', 
          callbacks: {
            onopen: () => {
                console.log("Gemini Live Session Opened (Callback)");
                callbacks.onOpen();
            },
            onmessage: async (message: LiveServerMessage) => {
              // Handle Tool Calls (if model decides to call tool during session)
              if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === 'reportAssessment') {
                    const rawData = fc.args;
                    const data = safeParseAssessment(rawData);
                    callbacks.onAssessment(data);
                    // Acknowledge tool call
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

              // Handle Audio Output
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
                
                // Visualization Data
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

              // --- ROBUST TRANSCRIPT HANDLING ---
              // User Transcript: Buffer it, don't commit to fullTranscript yet to avoid duplication
              const inputTranscript = message.serverContent?.inputTranscription?.text;
              if (inputTranscript) {
                  this.currentInputPart += inputTranscript; 
                  callbacks.onTranscript(inputTranscript, 'user', true);
              }

              // AI Transcript: Commit buffered user text, then append AI text
              const outputTranscript = message.serverContent?.outputTranscription?.text;
              if (outputTranscript) {
                  // If we have pending user input, commit it now
                  if (this.currentInputPart.trim()) {
                      this.fullTranscript += `User: ${this.currentInputPart.trim()}\n`;
                      this.currentInputPart = "";
                  }
                  
                  this.fullTranscript += `ATC: ${outputTranscript}\n`;
                  callbacks.onTranscript(outputTranscript, 'ai', false);
              }

              // Turn Complete: Flush any remaining user input buffer
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
              // Ensure we propagate error with a message
              const msg = e.message || "Connection Interrupted";
              callbacks.onError(new Error(msg));
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            // CRITICAL FIX: Enable Transcription
            inputAudioTranscription: {}, 
            outputAudioTranscription: {},
            systemInstruction: finalInstruction,
            tools: tools,
          },
        });

        // Initialize session promise
        await this.sessionPromise;
        this.startAudioInputStream();
        
        // Removed Kickstart message to prevent Race Condition / Network Error

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
    // We will downsample to 16k, so sending as 16k
    const mimeType = 'audio/pcm;rate=16000';

    this.processor.onaudioprocess = (e) => {
      // IMPLEMENTATION UPDATE: Keep-Alive Mechanism
      // Instead of returning when muted (which stops data flow and causes timeouts),
      // we send a silent buffer. This keeps the WebSocket connection active.
      
      const inputData = e.inputBuffer.getChannelData(0);
      let dataToProcess = inputData;

      if (this.isInputMuted) {
          // Fill with zeros (Silence)
          dataToProcess = new Float32Array(inputData.length).fill(0);
      }
      
      // CRITICAL FIX: Downsample audio to 16kHz before sending
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
    
    // CRITICAL FIX 1: Race Condition Prevention
    // Stop sending new audio, but keep connection open to receive final transcription.
    this.setInputMuted(true); 
    
    console.log("Waiting for trailing transcripts (buffer period)...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second buffer

    // Flush any remaining input buffer before disconnecting
    if (this.currentInputPart.trim()) {
        this.fullTranscript += `User: ${this.currentInputPart.trim()}\n`;
        this.currentInputPart = "";
    }

    // 1. Now we can disconnect safely
    await this.disconnect();

    // 2. Generate Report using standard GenerateContent API
    if (this.currentCallbacks && this.ai) {
        console.log("Full Transcript for Assessment:", this.fullTranscript);

        // CRITICAL FIX 3: Empty Transcript Protection
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
            console.log("Generating assessment report using Gemini 3 Flash...");
            const model = this.ai.models;
            
            // CRITICAL FIX 2: Ground Truth Injection
            // We explicitely tell the AI what SHOULD have happened vs what ACTUALLY happened.
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

            // Use Gemini 3 Flash for high quality reasoning and JSON generation
            const response = await model.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: assessmentSchema
                }
            });

            const jsonText = response.text;
            if (jsonText) {
                const parsed = JSON.parse(jsonText);
                const safeData = safeParseAssessment(parsed);
                this.currentCallbacks.onAssessment(safeData);
            } else {
                throw new Error("Empty response from assessment model.");
            }

        } catch (e) {
            console.error("Report generation failed:", e);
            // Return fallback error report
            this.currentCallbacks.onAssessment(safeParseAssessment({
                executiveSummary: { assessment: "Report generation failed due to network or model error.", safetyMargin: "N/A", frictionPoints: "N/A" }
            }));
        }
    }
  }

  async disconnect() {
    console.log("Disconnecting Live Client...");
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
