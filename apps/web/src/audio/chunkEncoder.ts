/**
 * Encodes Float32 PCM samples to a base64 string for inclusion in the
 * `audio.chunk` protocol message. Float32 is little-endian on every platform
 * we target (browsers always use little-endian Float32Array memory).
 *
 * For v1 we keep base64 because it's symmetric with pydantic on the backend
 * and survives the JSON envelope. Switching to a binary frame later only
 * changes this module + the transport serializer.
 */
export function pcmFloat32ToBase64(pcm: Float32Array): string {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function pcmFloat32FromBase64(b64: string): Float32Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}