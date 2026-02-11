
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type, Tool } from '@google/genai';
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

// Updated Tool Definition for Master-Level Report
const assessmentToolDefinition: FunctionDeclaration = {
  name: "reportAssessment",
  description: "GENERATE THE FINAL EXAM REPORT based on the provided transcript and analysis framework.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      overallScore: { type: Type.INTEGER, description: "Lowest of sub-scores (1-6)." },
      pronunciation: { type: Type.INTEGER },
      structure: { type: Type.INTEGER },
      vocabulary: { type: Type.INTEGER },
      fluency: { type: Type.INTEGER },
      comprehension: { type: Type.INTEGER },
      interactions: { type: Type.INTEGER },
      
      executiveSummary: {
        type: Type.OBJECT,
        properties: {
          assessment: { type: Type.STRING, description: "Holistic assessment of communicative competence." },
          safetyMargin: { type: Type.STRING, description: "Impact on flight safety (e.g. risk of runway incursion)." },
          frictionPoints: { type: Type.STRING, description: "Most critical failure points." }
        },
        required: ["assessment", "safetyMargin", "frictionPoints"]
      },
      
      dimensionalDetails: {
        type: Type.OBJECT,
        properties: {
          pronunciation: { type: Type.STRING, description: "Specific diagnosis (e.g. L1 interference)." },
          structure: { type: Type.STRING, description: "Grammar issues (Global vs Local)." },
          vocabulary: { type: Type.STRING, description: "Phraseology usage." },
          fluency: { type: Type.STRING, description: "Tempo, hesitation." },
          comprehension: { type: Type.STRING, description: "Understanding of instructions." },
          interactions: { type: Type.STRING, description: "Turn-taking and clarification." }
        },
        required: ["pronunciation", "structure", "vocabulary", "fluency", "comprehension", "interactions"]
      },

      deepAnalysis: {
        type: Type.ARRAY,
        description: "Top 3-4 critical errors analysis.",
        items: {
          type: Type.OBJECT,
          properties: {
            context: { type: Type.STRING, description: "Scene/Line reference from transcript." },
            issue: { type: Type.STRING, description: "Observed phenomenon." },
            theory: { type: Type.STRING, description: "Linguistic theoretical basis (e.g. Expectancy Bias)." },
            rootCause: { type: Type.STRING, description: "Cognitive/Linguistic root cause." },
            correction: { type: Type.STRING, description: "Specific technique to fix it." }
          },
          required: ["context", "issue", "theory", "rootCause", "correction"]
        }
      },

      remedialPlan: {
        type: Type.ARRAY,
        description: "3 specific actionable training methods.",
        items: { type: Type.STRING }
      }
    },
    required: ["overallScore", "pronunciation", "structure", "vocabulary", "fluency", "comprehension", "interactions", "executiveSummary", "dimensionalDetails", "deepAnalysis", "remedialPlan"]
  }
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

    // 2. Initialize Audio Contexts
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    this.fullTranscript = "";

    try {
      await this.inputAudioContext.resume();
      await this.outputAudioContext.resume();
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, sampleRate: 16000 }
      });
    } catch (err) {
      callbacks.onError(new Error("Microphone permission denied"));
      return;
    }

    const outputNode = this.outputAudioContext.createGain();
    outputNode.connect(this.outputAudioContext.destination);

    // Dynamic Difficulty Instruction
    const difficultyPrompt = this.getDifficultyInstruction(difficulty);

    // Master-Level System Prompt Injection
    const baseInstruction = `
    # ROLE: ICAO English Examiner (ATC) & Aviation Applied Linguist
    # OBJECTIVE: Conduct a realistic radiotelephony exam based on the selected difficulty.
    
    # SCENARIO: ${scenario.title} (${scenario.category || 'General'})
    - Phase: ${scenario.phase}
    - Weather: ${scenario.weather}
    - Details: ${scenario.details}
    - Callsign: "${scenario.callsign}"

    ${difficultyPrompt}

    # BEHAVIOR:
    1. Act as ATC. Maintain professional phraseology.
    2. Create complications based on the scenario details.
    3. *** CRITICAL ***: When user sends "EXAM_FINISHED", STOP ACTING.
    4. You will receive the full transcript. Analyze it deeply.
    5. Call the \`reportAssessment\` tool with the analysis data.
    
    # ANALYSIS FRAMEWORK (Applied Linguistics):
    - Diagnose root causes (e.g., Expectancy Bias, L1 Negative Transfer, Working Memory Overload).
    - Distinguish between Standard Phraseology and Plain English.
    - Assess Safety Margin (risk of runway incursion, etc.).
    - Output language for the report: SIMPLIFIED CHINESE (简体中文).
    `;

    const finalInstruction = customSystemInstruction || baseInstruction;

    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => callbacks.onOpen(),
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
                      response: { result: "Report Generated Successfully" }
                    }
                  });
                });
              }
            }
          }

          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio && this.outputAudioContext) {
            if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

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
        onclose: () => callbacks.onClose(),
        onerror: (e: any) => {
          console.error("Gemini Live API Error:", e);
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
        inputAudioTranscription: {}, 
        outputAudioTranscription: {},
      },
    });

    try {
        const session = await this.sessionPromise;
        this.startAudioInputStream();
        try {
            await session.send({ parts: [{ text: "Simulation Started. I am ready. Please contact me as ATC." }] });
        } catch (kickstartError) {
            console.warn("Failed to send kickstart message:", kickstartError);
        }
    } catch (e: any) {
        console.error("Failed to initialize session", e);
        callbacks.onError(new Error(e.message || "Failed to initialize session"));
    }
  }

  private startAudioInputStream() {
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(2048, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.isInputMuted) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const base64Data = this.float32ToBase64(inputData);
      
      this.sessionPromise?.then((session) => {
        session.sendRealtimeInput({
            media: {
                mimeType: "audio/pcm;rate=16000",
                data: base64Data
            },
        });
      });
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  async sendText(text: string) {
    if (this.sessionPromise) {
        try {
            const session = await this.sessionPromise;
            await session.send({
                parts: [{ text: text }],
            });
        } catch(e) {
            console.error("Failed to send text", e);
        }
    }
  }

  async finalize() {
    if (this.sessionPromise) {
        try {
            const session = await this.sessionPromise;
            const finalPrompt = `
[TRANSCRIPT START]
${this.fullTranscript}
[TRANSCRIPT END]

EXAM_FINISHED. Please generate the Master-Level Diagnostic Report now.
            `;
            await session.send({
                parts: [{ text: finalPrompt }],
                turnComplete: true
            });
        } catch (e) {
            console.error("Failed to finalize", e);
        }
    }
  }

  async disconnect() {
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
    }
    if (this.inputSource) {
        this.inputSource.disconnect();
    }
    
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
    }
    
    if (this.inputAudioContext && this.inputAudioContext.state !== 'closed') {
       try { await this.inputAudioContext.close(); } catch(e) {}
    }
    if (this.outputAudioContext && this.outputAudioContext.state !== 'closed') {
       try { await this.outputAudioContext.close(); } catch(e) {}
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
