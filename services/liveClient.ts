
import { supabase } from './supabaseClient';
import { Scenario, AppLanguage } from "../types";
import { createPcmBlob, decodeAudioData, normalizeAudio, bytesToBase64 } from "./audioUtils";
import { airportService } from "./airportService";

interface LiveClientCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Error) => void;
  onAudioData: (level: number) => void;
  onTurnComplete: () => void;
  onTranscript: (text: string, role: 'user' | 'ai', isPartial: boolean) => void;
}

// ARCHITECTURE CHANGE: 
// Direct Gemini connection removed. Now acts as a relay to Supabase Edge Functions.
// Communication Mode: Turn-Based (Record -> Send -> Reply).

export class LiveClient {
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
  public isBufferedMode = true; // Forced to true for turn-based
  private isInputMuted = true;
  
  // Data State
  private audioBufferQueue: Float32Array[] = [];
  private callbacks: LiveClientCallbacks | null = null;
  
  // Session Context
  private scenario: Scenario | null = null;
  private difficulty: string = 'Level 4';
  private airportCode: string = 'ZBAA';
  private conversationHistory: { role: 'user' | 'model', text: string }[] = [];

  constructor() {
    // Initialization
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
    this.scenario = scenario;
    this.difficulty = difficulty;
    this.airportCode = airportCode;
    this.conversationHistory = []; // Reset history

    // Audio Context Setup
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.inputAudioContext = new AudioContextClass({ sampleRate: 16000 });
    this.outputAudioContext = new AudioContextClass({ sampleRate: 24000 });
    this.outputNode = this.outputAudioContext.createGain();
    this.outputNode.connect(this.outputAudioContext.destination);

    console.log("LiveClient: Secure Audio Bridge Initialized (Server-Side Logic)");
    
    // FIX: Execute immediately to preserve User Gesture for permission prompt
    try {
        await this.initAudioInputStream();
        this.callbacks?.onOpen();
    } catch (e: any) {
        // Error is already handled in initAudioInputStream via callbacks.onError
        // But we ensure we don't leave the UI hanging if it wasn't caught there
        console.error("Connection sequence failed", e);
    }
  }

  private async initAudioInputStream() {
    try {
        if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
            throw new Error("SECURE CONTEXT REQUIRED: Microphone access requires HTTPS.");
        }

        // FIX: Removed 'sampleRate' constraint. 
        // Asking for 16000Hz directly often fails on consumer hardware. 
        // The AudioContext (initialized above with sampleRate: 16000) will handle resampling automatically.
        this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
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
            
            // Level Calc
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            this.callbacks?.onAudioData(rms * 5); 

            // Recording Logic
            if (this.isRecording) {
                // Clone the data since the buffer is reused
                this.audioBufferQueue.push(new Float32Array(inputData));
            }
        };

        this.inputSource.connect(this.processor);
        this.processor.connect(this.inputAudioContext.destination);

    } catch (e: any) {
        console.error("Mic init failed", e);
        // Map common errors to user friendly messages
        let msg = e.message;
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
            msg = "Microphone permission denied. Please allow access in browser settings.";
        } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
            msg = "No microphone found. Please check your hardware.";
        }
        this.callbacks?.onError(new Error(msg));
        throw e; // Re-throw to stop connection flow
    }
  }

  async startRecording() {
      if (this.inputAudioContext?.state === 'suspended') await this.inputAudioContext.resume();
      this.cancelOutput(); // Stop ATC from talking when user talks
      this.isRecording = true;
      this.audioBufferQueue = []; // Clear buffer
  }

  async stopRecording() {
      this.isRecording = false;
      
      // Process accumulated audio
      if (this.audioBufferQueue.length > 0) {
          await this.processTurn();
      }
  }

  private async processTurn() {
      // 1. Flatten Audio
      const totalLength = this.audioBufferQueue.reduce((acc, buf) => acc + buf.length, 0);
      const combined = new Float32Array(totalLength);
      let offset = 0;
      for (const buf of this.audioBufferQueue) {
          combined.set(buf, offset);
          offset += buf.length;
      }
      this.audioBufferQueue = []; // Clear immediately

      // 2. Normalize & Encode
      const normalized = normalizeAudio(combined);
      const pcmBlob = createPcmBlob(normalized);
      
      // Convert Blob to Base64 for Transport
      const audioBase64 = pcmBlob.data;

      // 3. Send to Supabase Edge Function
      this.sendToBackend(audioBase64);
  }

  private async sendToBackend(audioBase64: string) {
      try {
          // Optimistic UI or Loading State if needed
          
          const { data, error } = await supabase.functions.invoke('icao-conversation', {
              body: {
                  audio: audioBase64,
                  history: this.conversationHistory,
                  context: {
                      scenario: this.scenario,
                      difficulty: this.difficulty,
                      airport: this.airportCode
                  }
              }
          });

          if (error) throw error;

          if (data) {
              // 1. Handle User Transcript (ASR)
              if (data.userText) {
                  this.callbacks?.onTranscript(data.userText, 'user', false);
                  this.conversationHistory.push({ role: 'user', text: data.userText });
              }

              // 2. Handle AI Response (Text)
              if (data.aiText) {
                  this.callbacks?.onTranscript(data.aiText, 'ai', false);
                  this.conversationHistory.push({ role: 'model', text: data.aiText });
              }

              // 3. Handle AI Audio (TTS)
              if (data.aiAudio) {
                  await this.playAudio(data.aiAudio);
              }

              this.callbacks?.onTurnComplete();
          }

      } catch (e: any) {
          console.error("Edge Communication Failed", e);
          // Don't kill the session, just warn
          this.callbacks?.onError(new Error("Comm link unstable. Please retry."));
      }
  }

  // Alias for text input (e.g. Hint Request)
  async sendText(text: string) {
      // Create a dummy turn
      this.callbacks?.onTranscript(text, 'user', false);
      this.conversationHistory.push({ role: 'user', text });
      
      try {
          const { data, error } = await supabase.functions.invoke('icao-conversation', {
              body: {
                  text: text, // Send text instead of audio
                  history: this.conversationHistory,
                  context: {
                      scenario: this.scenario,
                      difficulty: this.difficulty,
                      airport: this.airportCode
                  }
              }
          });

          if (error) throw error;

          if (data) {
              if (data.aiText) {
                  this.callbacks?.onTranscript(data.aiText, 'ai', false);
                  this.conversationHistory.push({ role: 'model', text: data.aiText });
              }
              if (data.aiAudio) {
                  await this.playAudio(data.aiAudio);
              }
              this.callbacks?.onTurnComplete();
          }
      } catch (e) {
          console.error("Text Send Failed", e);
      }
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
      this.activeSources.forEach(s => { try { s.stop(); } catch(e) {} });
      this.activeSources = [];
      if (this.outputAudioContext) this.nextStartTime = this.outputAudioContext.currentTime;
  }

  setBufferedMode(enabled: boolean) { 
      // Always buffered in Server-Side Architecture
      this.isBufferedMode = true; 
  }
  
  setInputMuted(muted: boolean) { this.isInputMuted = muted; }

  disconnect() {
      this.cancelOutput(); 
      if (this.processor) { this.processor.disconnect(); this.processor = null; }
      if (this.inputSource) { this.inputSource.disconnect(); this.inputSource = null; }
      if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
      if (this.inputAudioContext) { this.inputAudioContext.close(); this.inputAudioContext = null; }
      if (this.outputAudioContext) { this.outputAudioContext.close(); this.outputAudioContext = null; }
      this.conversationHistory = [];
  }
}
