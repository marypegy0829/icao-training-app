
import { Blob } from '@google/genai';

export function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Resamples audio buffer to 16kHz using Web Audio API's OfflineAudioContext.
 * This provides hardware-accelerated, high-quality interpolation with anti-aliasing.
 * Solves the "robotic/metallic" voice issue caused by naive downsampling.
 */
export async function resampleTo16k(inputData: Float32Array, inputSampleRate: number): Promise<Float32Array> {
    if (inputSampleRate === 16000) return inputData;

    // Calculate new length
    const duration = inputData.length / inputSampleRate;
    const targetLength = Math.ceil(duration * 16000);

    // Create Offline Context
    // Note: OfflineAudioContext constructor: (numberOfChannels, length, sampleRate)
    const offlineCtx = new OfflineAudioContext(1, targetLength, 16000);
    
    // Create Buffer
    const buffer = offlineCtx.createBuffer(1, inputData.length, inputSampleRate);
    buffer.copyToChannel(inputData, 0);
    
    // Create Source
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    // Render
    const renderedBuffer = await offlineCtx.startRendering();
    return renderedBuffer.getChannelData(0);
}

/**
 * Normalizes audio to approx -2dB (0.8 amplitude).
 * Ensures consistent volume levels regardless of microphone gain.
 * Includes a NOISE GATE to prevent amplifying silence/background noise.
 */
export function normalizeAudio(inputData: Float32Array): Float32Array {
    let maxAmp = 0;
    for (let i = 0; i < inputData.length; i++) {
        const abs = Math.abs(inputData[i]);
        if (abs > maxAmp) maxAmp = abs;
    }

    // NOISE GATE: If max amplitude is below 0.02 (approx -34dB), treat as noise/silence.
    // Do NOT normalize (amplify) noise.
    if (maxAmp < 0.02) return inputData;

    // If already loud enough, return original
    if (maxAmp > 0.99) return inputData;

    // Target 0.8
    const targetAmp = 0.8;
    const gain = targetAmp / maxAmp;

    const result = new Float32Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
        result[i] = inputData[i] * gain;
    }
    return result;
}

// Low-quality realtime downsampler (Keep for streaming/Open Mic mode latency reasons)
export function downsampleTo16k(input: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) {
      return input;
  }
  const ratio = sampleRate / 16000;
  const newLength = Math.floor(input.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    
    // Averaging filter
    for (let j = start; j < end && j < input.length; j++) {
      sum += input[j];
      count++;
    }
    
    // Avoid division by zero
    result[i] = count > 0 ? sum / count : input[start];
  }
  return result;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Ensure strict alignment for Int16Array by copying if necessary
  let alignedData = data;
  if (data.byteOffset % 2 !== 0) {
      alignedData = new Uint8Array(data.length);
      alignedData.set(data);
  }

  const byteLength = alignedData.byteLength - (alignedData.byteLength % 2);
  const dataInt16 = new Int16Array(alignedData.buffer, alignedData.byteOffset, byteLength / 2);
  
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert PCM 16-bit to Float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: bytesToBase64(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}
