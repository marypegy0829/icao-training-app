
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

// NEW: Downsample any sample rate to 16000Hz using Linear Interpolation
export function downsampleTo16k(input: Float32Array, sampleRate: number): Float32Array {
  if (sampleRate === 16000) {
      return input;
  }
  const targetRate = 16000;
  const ratio = sampleRate / targetRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    const index1 = Math.floor(originalIndex);
    const index2 = Math.min(index1 + 1, input.length - 1);
    const fraction = originalIndex - index1;
    
    // Linear Interpolation
    result[i] = input[index1] * (1 - fraction) + input[index2] * fraction;
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
