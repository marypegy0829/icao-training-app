
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Tool, Schema } from '@google/genai';
import { base64ToBytes, decodeAudioData } from './audioUtils';
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

// Helper to safely parse and default the assessment data to avoid runtime crashes
function safeParseAssessment(data: any): AssessmentData {
    // defaults
    return {
        overallScore: typeof data.overallScore === 'number' ? data.overallScore : 1,
        pronunciation: typeof data.pronunciation === 'number' ? data.pronunciation : 1,
        structure: typeof data.structure === 'number' ? data.structure : 1,
        vocabulary: typeof data.vocabulary === 'number' ? data.vocabulary : 1,
        fluency: typeof data.fluency === 'number' ? data.fluency : 1,
        comprehension: typeof data.comprehension === 'number' ? data.comprehension : 1,
        interactions: typeof data.interactions === 'number' ? data.interactions : 1,
        
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
    overallScore: { type: Type.NUMBER, description: "Overall ICAO Level (1-6)." },
    pronunciation: { type: Type.NUMBER, description: "Score (1-6) for Pronunciation." },
    structure: { type: Type.NUMBER, description: "Score (1-6) for Structure." },
    vocabulary: { type: Type.NUMBER, description: "Score (1-6) for Vocabulary." },
    fluency: { type: Type.NUMBER, description: "Score (1-6) for Fluency." },
    comprehension: { type: Type.NUMBER, description: "Score (1-6) for Comprehension." },
    interactions: { type: Type.NUMBER, description: "Score (1-6) for Interactions." },
    
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
      description: "List of 3-5 critical linguistic errors found in the transcript.",
      items: {
        type: Type.OBJECT,
        properties: {
          context: { type: Type.STRING, description: "The exact quote from the user causing the error." },
          issue: { type: Type.STRING, description: "Description of the error (Chinese)." },
          theory: { type: Type.STRING, description: "Linguistic or ICAO principle violated (Chinese). Make it educational." },
          rootCause: { type: Type.STRING, description: "Likely cause (e.g. L1 interference, lack of knowledge) (Chinese)." },
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
  private fullTranscript: string = ""; // Accumulate transcript for context
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

    // 2. Initialize Audio Contexts
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    
    try {
        this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
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
      console.log("Microphone access granted. Input Sample Rate:", this.inputAudioContext.sampleRate);
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

              // Handle Transcripts
              const inputTranscript = message.serverContent?.inputTranscription?.text;
              if (inputTranscript) {
                  this.fullTranscript += `User: ${inputTranscript}\n`;
                  callbacks.onTranscript(inputTranscript, 'user', true);
              }

              const outputTranscript = message.serverContent?.outputTranscription?.text;
              if (outputTranscript) {
                  this.fullTranscript += `ATC: ${outputTranscript}\n`;
                  callbacks.onTranscript(outputTranscript, 'ai', false);
              }

              if (message.serverContent?.turnComplete) {
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
              const msg = e.message || "Connection Error";
              callbacks.onError(new Error(msg));
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: finalInstruction,
            tools: tools,
          },
        });

        const session = await this.sessionPromise;
        this.startAudioInputStream();
        
        // Kickstart message
        try {
            if (typeof session.send === 'function') {
                await session.send({ parts: [{ text: "Simulation Started. I am ready." }] });
            }
        } catch (kickstartError) {
            console.warn("Kickstart message skipped (optional).");
        }

    } catch (e: any) {
        console.error("Failed to initialize session:", e);
        callbacks.onError(new Error(e.message || "Failed to initialize session. Check API Key."));
    }
  }

  private startAudioInputStream() {
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    const actualSampleRate = this.inputAudioContext.sampleRate;
    const mimeType = `audio/pcm;rate=${actualSampleRate}`;

    this.processor.onaudioprocess = (e) => {
      if (this.isInputMuted) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const base64Data = this.float32ToBase64(inputData);
      
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
  // Instead of relying on the Live Session to generate the report (which fails if send() is missing),
  // we disconnect the session and use a dedicated Text Model (Gemini 3 Flash) to process the transcript.
  async finalize() {
    console.log("Finalizing session...");
    
    // 1. Disconnect immediately to stop audio processing
    await this.disconnect();

    // 2. Generate Report using standard GenerateContent API
    if (this.currentCallbacks && this.ai) {
        if (!this.fullTranscript.trim()) {
            console.warn("No transcript available for assessment.");
             // Return empty/fail assessment
             this.currentCallbacks.onAssessment(safeParseAssessment({
                 overallScore: 1,
                 executiveSummary: { assessment: "No audio detected.", safetyMargin: "N/A", frictionPoints: "N/A" }
             }));
            return;
        }

        try {
            console.log("Generating assessment report using Gemini 3 Flash...");
            const model = this.ai.models;
            
            // Construct the prompt for the text model
            const prompt = `
            # ICAO ENGLISH ASSESSMENT TASK (Strict JSON Output)
            Based on the following transcript of a radiotelephony simulation, generate a detailed ICAO Level 5 assessment report.
            
            SCENARIO: ${this.scenarioContext?.title}
            
            TRANSCRIPT:
            ${this.fullTranscript}
            
            REQUIREMENTS:
            1. ACT AS A SENIOR EXAMINER. Be strict but educational.
            2. JSON Output ONLY. Follow the schema exactly.
            3. All text fields MUST be in SIMPLIFIED CHINESE (简体中文), except for specific English quotes or corrections.
            4. In 'deepAnalysis', identify REAL errors (e.g. missing readback, wrong preposition, stuttering, non-standard phraseology). 
            5. If performance was perfect, nitpick on minor fluency or pronunciation issues to provide value.
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
