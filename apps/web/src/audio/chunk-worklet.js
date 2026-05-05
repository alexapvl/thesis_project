// AudioWorkletProcessor that downmixes to mono, resamples to 48 kHz with
// linear interpolation across process() boundaries, and posts fixed-size
// 2048-sample chunks back to the main thread.
//
// This file is plain JavaScript (not TypeScript) because Vite's `?url`
// import does not compile TS sources as standalone modules — the browser
// needs to fetch a ready-to-run script for `audioWorklet.addModule()`.

const TARGET_SAMPLE_RATE = 48000;
const CHUNK_SIZE = 2048;

class ChunkProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.resampleRatio = sampleRate / TARGET_SAMPLE_RATE;
    this.resamplePos = 0;
    this.resampleLast = 0;
    this.buffer = new Float32Array(CHUNK_SIZE);
    this.bufferFill = 0;
    this.sequence = 0;
    this.chunkStartTime = currentTime;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0] || input[0].length === 0) {
      return true;
    }

    const frames = input[0].length;
    // Downmix to mono: average channels into a temporary frame buffer.
    const mono = new Float32Array(frames);
    const channels = input.length;
    if (channels === 1) {
      mono.set(input[0]);
    } else {
      for (let ch = 0; ch < channels; ch++) {
        const data = input[ch];
        for (let i = 0; i < frames; i++) mono[i] += data[i];
      }
      const scale = 1 / channels;
      for (let i = 0; i < frames; i++) mono[i] *= scale;
    }

    // Linear-interpolation resample using a running fractional cursor that
    // persists across calls. `resampleLast` holds the final sample of the
    // previous block so we can interpolate the boundary correctly.
    let pos = this.resamplePos;
    while (pos < frames) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = i === 0 ? this.resampleLast : mono[i - 1];
      const b = mono[i];
      const sample = a + (b - a) * frac;

      this.buffer[this.bufferFill++] = sample;
      if (this.bufferFill >= CHUNK_SIZE) {
        const out = this.buffer.slice(0, CHUNK_SIZE);
        this.port.postMessage(
          {
            type: 'chunk',
            pcm: out,
            sequence: this.sequence++,
            startTimeS: this.chunkStartTime,
          },
          [out.buffer],
        );
        this.buffer = new Float32Array(CHUNK_SIZE);
        this.bufferFill = 0;
        this.chunkStartTime = currentTime + (pos / frames) * (frames / sampleRate);
      }

      pos += this.resampleRatio;
    }
    this.resamplePos = pos - frames;
    this.resampleLast = mono[frames - 1];

    return true;
  }
}

registerProcessor('chunk-processor', ChunkProcessor);
