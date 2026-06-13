/**
 * Fully synthesized museum audio — no audio files. A quiet ambient pad plus
 * tiny interaction cues. Everything routes through one master gain so mute is
 * instant, and the preference persists in localStorage.
 */
const MUTE_KEY = 'museum-muted';

export class MuseumAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean;

  constructor() {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(MUTE_KEY);
    } catch {
      // Storage can be unavailable (private mode, embedded contexts).
    }
    this.muted = stored === '1';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Must be called from a user gesture (the Enter button click). */
  start(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    // Ambient pad: three quiet detuned oscillators through a lowpass,
    // with a very slow tremolo so the hum breathes.
    const pad = ctx.createGain();
    pad.gain.value = 0;
    pad.connect(this.master);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 240;
    lowpass.connect(pad);
    const voices: [number, OscillatorType, number][] = [
      [55, 'sine', 0.5],
      [110.4, 'sine', 0.25],
      [164.8, 'triangle', 0.1],
    ];
    for (const [freq, type, gain] of voices) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g);
      g.connect(lowpass);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.018;
    lfo.connect(lfoDepth);
    lfoDepth.connect(pad.gain);
    lfo.start();
    pad.gain.setTargetAtTime(0.06, ctx.currentTime, 2.5);
  }

  /** Returns the new muted state. */
  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Best effort.
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  /** Soft two-note chime when an exhibit is selected. */
  select(): void {
    this.blip(523.25, 0.22, 'sine', 0.09);
    this.blip(783.99, 0.3, 'sine', 0.07, 0.07);
  }

  /** Barely-there tick when the hover target changes. */
  hover(): void {
    this.blip(1318.5, 0.045, 'sine', 0.022);
  }

  /** Filtered-noise sweep for room teleports. */
  whoosh(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(160, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.55);
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    when = 0
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }
}
