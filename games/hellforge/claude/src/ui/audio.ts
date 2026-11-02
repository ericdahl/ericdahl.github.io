import type { SoundId } from '../game/world';

/** Tiny procedural sound bank on WebAudio; no audio files needed. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private last: Partial<Record<SoundId, number>> = {};
  private ambient: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  enabled = true;

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    const t = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    const t = c.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(id: SoundId) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    if ((this.last[id] ?? -1) > now - 0.05) return;
    this.last[id] = now;
    switch (id) {
      case 'swing': return this.hiss(0.12, 0.25, 1800, 0.8);
      case 'hit': this.hiss(0.08, 0.5, 600, 1); return this.tone('square', 140, 60, 0.08, 0.12);
      case 'miss': return this.hiss(0.08, 0.15, 2500, 2);
      case 'death': this.tone('sawtooth', 220, 50, 0.4, 0.12); return this.hiss(0.3, 0.2, 400, 0.6);
      case 'hurt': return this.tone('sawtooth', 160, 90, 0.18, 0.2);
      case 'gold': [1500, 2100, 2600].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.08, 0.08, i * 0.04)); return;
      case 'item': return this.tone('triangle', 520, 380, 0.12, 0.15);
      case 'unique': [660, 880, 1320].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.12, i * 0.09)); return;
      case 'potion': this.hiss(0.2, 0.2, 900, 3); return this.tone('sine', 300, 600, 0.2, 0.1);
      case 'levelup': [392, 523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.6, 0.15, i * 0.12)); return;
      case 'fire': this.hiss(0.35, 0.3, 700, 0.5, 'lowpass'); return this.tone('sawtooth', 120, 60, 0.3, 0.06);
      case 'cold': this.hiss(0.25, 0.25, 3500, 2); return this.tone('sine', 1200, 600, 0.25, 0.06);
      case 'light': this.hiss(0.2, 0.3, 5000, 0.5, 'highpass'); return this.tone('square', 900, 200, 0.12, 0.05);
      case 'bow': this.tone('triangle', 260, 120, 0.1, 0.15); return this.hiss(0.08, 0.15, 3000, 2);
      case 'portal': return [300, 450, 600].forEach((f, i) => this.tone('sine', f, f * 1.5, 0.5, 0.08, i * 0.06));
      case 'nova': return this.hiss(0.5, 0.35, 2600, 0.7);
      case 'block': return this.tone('square', 900, 700, 0.06, 0.12);
      case 'shrine': return [523, 659, 784, 1046].forEach((f, i) => this.tone('sine', f, f, 0.4, 0.1, i * 0.07));
      case 'chest': return this.tone('square', 200, 120, 0.12, 0.1);
      case 'boom': this.hiss(0.5, 0.6, 180, 0.6, 'lowpass'); return this.tone('sine', 90, 30, 0.45, 0.35);
      case 'nomana': return this.tone('sine', 200, 160, 0.15, 0.1);
      case 'roar': this.tone('sawtooth', 110, 60, 0.6, 0.18); return this.hiss(0.6, 0.2, 300, 0.8, 'lowpass');
      case 'quest': return [523, 659, 784, 659, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.12, i * 0.13));
      case 'step': return this.hiss(0.04, 0.05, 300, 1);
    }
  }

  /** Low filtered rumble that changes per area for atmosphere. */
  ambience(areaId: string) {
    if (!this.ctx) return;
    if (this.ambient) {
      const old = this.ambient;
      old.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
      setTimeout(() => old.src.stop(), 2000);
      this.ambient = null;
    }
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = areaId === 'town' ? 500 : areaId === 'hellforge' ? 160 : 260;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.setTargetAtTime(areaId === 'town' ? 0.05 : 0.09, c.currentTime, 1);
    s.connect(f).connect(g).connect(this.master!);
    s.start();
    this.ambient = { src: s, gain: g };
  }
}
