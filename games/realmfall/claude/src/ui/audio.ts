/** Small synthesized sound effects. No audio files. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
export let muted = false;

function ac() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}

function noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
  const c = ac();
  if (!c || muted || !master) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start();
}

function tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
  const c = ac();
  if (!c || muted || !master) return;
  const o = c.createOscillator();
  o.type = type;
  const t0 = c.currentTime + delay;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export const sfx = {
  swing: () => noise(0.18, 900, 0.8, 0.5),
  hit: () => { noise(0.12, 300, 1.2, 0.9, 'lowpass'); tone(120, 0.1, 0.25, 'triangle', 0.5); },
  block: () => { tone(900, 0.12, 0.15, 'square', 0.6); noise(0.08, 2500, 2, 0.3); },
  bow: () => { tone(220, 0.15, 0.2, 'triangle', 1.8); noise(0.1, 3000, 1, 0.2); },
  cast: (school: string) => {
    const base = school === 'fire' ? 180 : school === 'cold' ? 520 : school === 'holy' ? 440 : 330;
    tone(base, 0.5, 0.08, 'sine', 1.5);
    tone(base * 1.5, 0.5, 0.05, 'sine', 1.5, 0.05);
  },
  release: (school: string) => {
    if (school === 'fire') noise(0.4, 600, 0.6, 0.6, 'lowpass');
    else if (school === 'cold') { tone(1200, 0.3, 0.08, 'sine', 0.5); noise(0.25, 4000, 2, 0.2); }
    else if (school === 'holy') { tone(660, 0.6, 0.1, 'sine'); tone(990, 0.6, 0.07, 'sine', 1, 0.08); }
    else { tone(80, 0.3, 0.25, 'sawtooth', 0.4); noise(0.3, 1500, 0.7, 0.4); }
  },
  heal: () => { tone(523, 0.4, 0.07); tone(659, 0.4, 0.07, 'sine', 1, 0.08); tone(784, 0.5, 0.07, 'sine', 1, 0.16); },
  level: () => { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.7, 0.09, 'triangle', 1, i * 0.09)); },
  death: () => { tone(220, 1.2, 0.15, 'sawtooth', 0.4); },
  click: () => tone(700, 0.05, 0.06, 'square'),
  error: () => tone(160, 0.12, 0.08, 'square'),
  horn: () => { tone(147, 1.4, 0.12, 'sawtooth', 1.02); tone(220, 1.4, 0.08, 'sawtooth', 1.02, 0.1); },
  coin: () => { tone(1320, 0.08, 0.06, 'square'); tone(1760, 0.12, 0.05, 'square', 1, 0.06); },
};
