type Sfx = 'click' | 'error' | 'bolt' | 'laser' | 'shell' | 'boom' | 'ready' | 'alert' | 'build';

/** Minimal synthesized sound effects so the game ships with no audio assets. */
export class Audio {
  private ctx: AudioContext | null = null;
  private last = new Map<Sfx, number>();
  muted = false;

  /** Must be called from a user gesture on iOS. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(s: Sfx, volume = 1) {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const minGap = s === 'bolt' || s === 'laser' ? 0.06 : s === 'boom' ? 0.08 : 0.03;
    if (now - (this.last.get(s) ?? -1) < minGap) return;
    this.last.set(s, now);
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, now + delay);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + delay + dur);
      og.gain.setValueAtTime(vol * volume, now + delay);
      og.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      o.connect(og).connect(g);
      o.start(now + delay);
      o.stop(now + delay + dur + 0.02);
    };
    const noise = (dur: number, vol: number, freq: number) => {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const ng = ctx.createGain();
      ng.gain.value = vol * volume;
      src.connect(f).connect(ng).connect(g);
      src.start(now);
    };
    switch (s) {
      case 'click': tone('square', 900, 600, 0.04, 0.04); break;
      case 'error': tone('sawtooth', 180, 120, 0.18, 0.06); break;
      case 'bolt': tone('square', 1400, 300, 0.07, 0.025); break;
      case 'laser': tone('sawtooth', 2200, 200, 0.18, 0.03); break;
      case 'shell': noise(0.25, 0.12, 600); break;
      case 'boom': noise(0.5, 0.2, 400); tone('sine', 120, 40, 0.4, 0.12); break;
      case 'ready': tone('sine', 520, 520, 0.08, 0.05); tone('sine', 780, 780, 0.12, 0.05, 0.08); break;
      case 'build': tone('triangle', 300, 600, 0.2, 0.06); break;
      case 'alert': tone('square', 700, 700, 0.15, 0.05); tone('square', 520, 520, 0.2, 0.05, 0.18); break;
    }
  }
}
