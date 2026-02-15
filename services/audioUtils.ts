
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

// IMPROVED: Downsample to 16000Hz using Averaging (Box-car filter)
// This acts as a simple Low-Pass Filter to prevent aliasing artifacts (hissing/distortion)
// which significantly improves speech recognition accuracy for consonants (s, f, th).
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
  // data.buffer might be a slice of a larger buffer with odd offset
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
