/**
 * Generative score and ambient sound beds, all synthesized on WebAudio.
 *
 * Each area theme has a mood: a key, a tempo, and how often each layer plays. A scheduler
 * looks a little ahead and queues notes on the audio clock: a drone, slow chord pads, a sparse
 * melody that wanders the scale, rare bells, drums that rise with combat intensity, and a
 * heartbeat when life runs low. Ambient events (fire crackle, wind, drips, chains, rumbles)
 * use the same clock but go to the sound-effects bus, so they follow the Sound setting.
 */

type Voice = 'pluck' | 'bow' | 'choir';
type AmbientKind = 'crackle' | 'wind' | 'drip' | 'owl' | 'chains' | 'whisper' | 'rumble' | 'bell_far';

interface Mood {
  root: number;
  scale: number[];
  bpm: number;
  /** Chance per beat of a melody note, and its voice. */
  melody: number;
  voice: Voice;
  /** Melody register in octaves above the root. */
  octave: number;
  pad: number;
  padVoice: 'saw' | 'choir';
  bells: number;
  drone: number;
  /** Drums play at all times at this intensity (the forge's war drums). */
  drumFloor: number;
  /** Chord roots as scale degrees, cycled every two bars. */
  chords: number[];
  ambient: { kind: AmbientKind; every: number }[];
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10];
const HELLISH = [0, 1, 4, 5, 6, 8, 10];
/** The augmented second gives Act 2 its sound. */
const DESERT = [0, 1, 4, 5, 7, 8, 10];
const DESERT_MINOR = [0, 2, 3, 6, 7, 8, 11];

export const MOODS: Record<string, Mood> = {
  town: {
    root: 50, scale: DORIAN, bpm: 66, melody: 0.42, voice: 'pluck', octave: 1, pad: 0.6, padVoice: 'saw', bells: 0.02, drone: 0.35, drumFloor: 0,
    chords: [0, 5, 3, 4], ambient: [{ kind: 'crackle', every: 0.9 }, { kind: 'wind', every: 14 }],
  },
  fields: {
    root: 38, scale: PHRYGIAN, bpm: 56, melody: 0.22, voice: 'bow', octave: 2, pad: 0.7, padVoice: 'saw', bells: 0.03, drone: 0.8, drumFloor: 0,
    chords: [0, 1, 5, 0], ambient: [{ kind: 'wind', every: 7 }, { kind: 'crackle', every: 6 }],
  },
  forest: {
    root: 40, scale: AEOLIAN, bpm: 52, melody: 0.2, voice: 'pluck', octave: 2, pad: 0.6, padVoice: 'saw', bells: 0.02, drone: 0.7, drumFloor: 0,
    chords: [0, 5, 6, 4], ambient: [{ kind: 'wind', every: 9 }, { kind: 'owl', every: 18 }],
  },
  cave: {
    root: 37, scale: PHRYGIAN, bpm: 46, melody: 0.08, voice: 'bow', octave: 2, pad: 0.4, padVoice: 'saw', bells: 0.12, drone: 1, drumFloor: 0,
    chords: [0, 1, 0, 6], ambient: [{ kind: 'drip', every: 2.2 }, { kind: 'rumble', every: 25 }],
  },
  chapel: {
    root: 41, scale: HARMONIC, bpm: 46, melody: 0.14, voice: 'choir', octave: 1, pad: 0.8, padVoice: 'choir', bells: 0.14, drone: 0.7, drumFloor: 0,
    chords: [0, 5, 3, 4], ambient: [{ kind: 'drip', every: 3 }, { kind: 'bell_far', every: 22 }, { kind: 'whisper', every: 16 }],
  },
  crypt: {
    root: 36, scale: LOCRIAN, bpm: 50, melody: 0.12, voice: 'bow', octave: 2, pad: 0.55, padVoice: 'choir', bells: 0.1, drone: 0.9, drumFloor: 0,
    chords: [0, 1, 4, 0], ambient: [{ kind: 'chains', every: 11 }, { kind: 'whisper', every: 9 }, { kind: 'drip', every: 5 }],
  },
  hell: {
    root: 33, scale: HELLISH, bpm: 72, melody: 0.2, voice: 'bow', octave: 2, pad: 0.6, padVoice: 'saw', bells: 0.04, drone: 1, drumFloor: 0.35,
    chords: [0, 1, 4, 1], ambient: [{ kind: 'rumble', every: 6 }, { kind: 'crackle', every: 1.2 }],
  },
  oasis: {
    root: 52, scale: DESERT, bpm: 74, melody: 0.5, voice: 'pluck', octave: 1, pad: 0.45, padVoice: 'saw', bells: 0.03, drone: 0.45, drumFloor: 0.08,
    chords: [0, 1, 0, 6], ambient: [{ kind: 'wind', every: 12 }],
  },
  desert: {
    root: 40, scale: DESERT, bpm: 62, melody: 0.3, voice: 'pluck', octave: 2, pad: 0.55, padVoice: 'saw', bells: 0.02, drone: 0.9, drumFloor: 0.1,
    chords: [0, 1, 5, 1], ambient: [{ kind: 'wind', every: 5 }],
  },
  glass: {
    root: 42, scale: DESERT_MINOR, bpm: 48, melody: 0.16, voice: 'choir', octave: 2, pad: 0.75, padVoice: 'choir', bells: 0.2, drone: 0.75, drumFloor: 0,
    chords: [0, 5, 1, 4], ambient: [{ kind: 'wind', every: 6 }, { kind: 'whisper', every: 20 }],
  },
  mesa: {
    root: 38, scale: DESERT, bpm: 70, melody: 0.24, voice: 'bow', octave: 2, pad: 0.5, padVoice: 'saw', bells: 0.03, drone: 0.9, drumFloor: 0.18,
    chords: [0, 1, 4, 1], ambient: [{ kind: 'wind', every: 7 }, { kind: 'rumble', every: 22 }],
  },
  cistern: {
    root: 36, scale: DESERT_MINOR, bpm: 44, melody: 0.08, voice: 'bow', octave: 2, pad: 0.45, padVoice: 'saw', bells: 0.14, drone: 1, drumFloor: 0,
    chords: [0, 1, 0, 5], ambient: [{ kind: 'drip', every: 1.8 }, { kind: 'whisper', every: 11 }],
  },
  ruins: {
    root: 37, scale: DESERT, bpm: 54, melody: 0.14, voice: 'choir', octave: 1, pad: 0.7, padVoice: 'choir', bells: 0.1, drone: 0.85, drumFloor: 0.06,
    chords: [0, 5, 1, 0], ambient: [{ kind: 'whisper', every: 10 }, { kind: 'bell_far', every: 26 }, { kind: 'rumble', every: 30 }],
  },
  vault: {
    root: 34, scale: DESERT_MINOR, bpm: 78, melody: 0.22, voice: 'choir', octave: 2, pad: 0.8, padVoice: 'choir', bells: 0.12, drone: 1, drumFloor: 0.4,
    chords: [0, 1, 4, 6], ambient: [{ kind: 'rumble', every: 5 }, { kind: 'whisper', every: 8 }],
  },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private ctx: AudioContext;
  private noise: AudioBuffer;
  private bus: GainNode;
  private sfx: GainNode;
  private wet: GainNode;
  private dryIn: GainNode;
  private mood: Mood | null = null;
  /** The area theme the score is playing. */
  theme = '';
  private drone: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  private timer = 0;
  private nextBeat = 0;
  private beat = 0;
  private melodyDeg = 0;
  private ambientAt: number[] = [];
  private nextHeart = 0;
  /** 0..1, smoothed: how hard the fighting is. */
  intensity = 0;
  private targetIntensity = 0;
  /** Life fraction; the heartbeat starts below 35%. */
  life = 1;
  private on = true;

  constructor(ctx: AudioContext, noise: AudioBuffer, sfxOut: AudioNode) {
    this.ctx = ctx;
    this.noise = noise;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.26;
    this.bus.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.sfx.connect(sfxOut);
    // A long, dark hall reverb from decaying noise.
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    conv.buffer = ir;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.dryIn = ctx.createGain();
    this.dryIn.connect(this.bus);
    this.dryIn.connect(conv);
    conv.connect(tone).connect(this.wet).connect(this.bus);
    this.timer = window.setInterval(() => this.tick(), 100);
  }

  setEnabled(on: boolean) {
    this.on = on;
    this.bus.gain.setTargetAtTime(on ? 0.26 : 0, this.ctx.currentTime, 0.3);
  }

  setTheme(theme: string) {
    const m = MOODS[theme] ?? MOODS.fields;
    this.theme = theme;
    if (m === this.mood) return;
    this.mood = m;
    const now = this.ctx.currentTime;
    this.nextBeat = Math.max(this.nextBeat, now + 0.2);
    this.beat = 0;
    this.melodyDeg = 0;
    this.ambientAt = m.ambient.map((a) => now + Math.random() * a.every);
    this.startDrone(m);
  }

  setIntensity(v: number) {
    this.targetIntensity = Math.max(0, Math.min(1, v));
  }

  dispose() {
    window.clearInterval(this.timer);
  }

  // ---------------------------------------------------------------- scheduling

  private tick() {
    const m = this.mood;
    if (!m) return;
    const c = this.ctx;
    const ahead = c.currentTime + 0.4;
    this.intensity += (this.targetIntensity - this.intensity) * 0.08;
    const spb = 60 / m.bpm;
    if (this.nextBeat < c.currentTime - 1) this.nextBeat = c.currentTime + 0.05;
    while (this.nextBeat < ahead) {
      if (this.on) this.playBeat(m, this.nextBeat, spb);
      this.nextBeat += spb;
      this.beat++;
    }
    for (let i = 0; i < m.ambient.length; i++) {
      while (this.ambientAt[i] < ahead) {
        this.ambient(m.ambient[i].kind, this.ambientAt[i]);
        this.ambientAt[i] += m.ambient[i].every * (0.5 + Math.random());
      }
    }
    // Heartbeat: faster the closer to death.
    if (this.life < 0.35) {
      if (this.nextHeart < c.currentTime) this.nextHeart = c.currentTime + 0.05;
      while (this.nextHeart < ahead) {
        const k = Math.max(0, this.life) / 0.35;
        this.heart(this.nextHeart, 0.6 + (1 - k) * 0.4);
        this.nextHeart += 60 / (62 + (1 - k) * 58);
      }
    }
  }

  private note(deg: number, oct = 0): number {
    const m = this.mood!;
    const n = m.scale.length;
    const o = Math.floor(deg / n);
    return m.root + m.scale[((deg % n) + n) % n] + 12 * (o + oct);
  }

  private playBeat(m: Mood, t: number, spb: number) {
    const bar = Math.floor(this.beat / 4);
    const inBar = this.beat % 4;
    // Pads: a new chord every two bars, held long with a slow swell.
    if (this.beat % 8 === 0 && Math.random() < m.pad + 0.2) {
      const root = m.chords[(bar / 2) % m.chords.length];
      for (const d of [0, 2, 4]) this.padNote(mtof(this.note(root + d, 1)), t, spb * 8, m.padVoice);
    }
    // Melody: a random walk on the scale, resolving toward the chord root now and then.
    const busy = m.melody + this.intensity * 0.25;
    if (Math.random() < busy) {
      const step = Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : Math.round((Math.random() - 0.5) * 6);
      this.melodyDeg = Math.max(-3, Math.min(9, this.melodyDeg + step));
      if (inBar === 0 && Math.random() < 0.3) this.melodyDeg = m.chords[(bar / 2 | 0) % m.chords.length];
      const f = mtof(this.note(this.melodyDeg, m.octave));
      this.melodyNote(f, t + (Math.random() < 0.25 ? spb / 2 : 0), m.voice === 'pluck' ? spb * 1.5 : spb * 2.5, m.voice);
    }
    if (Math.random() < m.bells / 4) this.bell(mtof(this.note(Math.floor(Math.random() * 7), 2)), t);
    // Drums: rise with the fight.
    const drums = Math.max(m.drumFloor, this.intensity);
    if (drums > 0.25 && (inBar === 0 || inBar === 2)) this.drum(t, 0.5 + drums * 0.5);
    if (drums > 0.55 && inBar === 3) this.drum(t + spb / 2, 0.4 + drums * 0.3);
    if (drums > 0.75) this.tick8(t + spb / 2);
  }

  // ---------------------------------------------------------------- voices

  private env(g: GainNode, t: number, a: number, peak: number, dur: number, rel: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
  }

  private startDrone(m: Mood) {
    const c = this.ctx;
    const now = c.currentTime;
    if (this.drone) {
      const old = this.drone;
      old.gain.gain.setTargetAtTime(0.0001, now, 1.2);
      for (const o of old.oscs) o.stop(now + 6);
    }
    const g = c.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.07 * m.drone, now + 0.5, 2.5);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    f.Q.value = 3;
    // A slow breathing filter sweep.
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    lfo.frequency.value = 0.06;
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(f.frequency);
    const oscs = [lfo];
    for (const [semi, det, type] of [[0, -6, 'sawtooth'], [0, 5, 'sawtooth'], [7, 0, 'triangle'], [-12, 0, 'sine']] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = mtof(m.root + semi);
      o.detune.value = det;
      o.connect(f);
      oscs.push(o);
    }
    f.connect(g).connect(this.dryIn);
    for (const o of oscs) o.start(now);
    this.drone = { oscs, gain: g };
  }

  private padNote(freq: number, t: number, dur: number, voice: 'saw' | 'choir') {
    const c = this.ctx;
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = voice === 'choir' ? 1400 : 700;
    this.env(g, t, dur * 0.35, voice === 'choir' ? 0.035 : 0.04, dur, dur * 0.4);
    const types: OscillatorType[] = voice === 'choir' ? ['triangle', 'sine', 'triangle'] : ['sawtooth', 'sawtooth'];
    types.forEach((type, i) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq * (voice === 'choir' && i === 1 ? 2 : 1);
      o.detune.value = (i - 1) * 8;
      if (voice === 'choir') {
        const v = c.createOscillator();
        const vg = c.createGain();
        v.frequency.value = 4.5 + i * 0.3;
        vg.gain.value = 6;
        v.connect(vg).connect(o.detune);
        v.start(t);
        v.stop(t + dur * 1.5);
      }
      o.connect(f);
      o.start(t);
      o.stop(t + dur * 1.5);
    });
    f.connect(g).connect(this.dryIn);
  }

  private melodyNote(freq: number, t: number, dur: number, voice: Voice) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    if (voice === 'pluck') {
      // A dark lute: bright attack, quick filter close.
      o.type = 'triangle';
      f.frequency.setValueAtTime(3000, t);
      f.frequency.exponentialRampToValueAtTime(400, t + 0.4);
      this.env(g, t, 0.005, 0.12, 0.05, dur);
    } else {
      // A bowed string or a voice: slow swell with vibrato.
      o.type = voice === 'choir' ? 'triangle' : 'sawtooth';
      f.frequency.value = voice === 'choir' ? 1600 : 900;
      this.env(g, t, dur * 0.3, voice === 'choir' ? 0.07 : 0.05, dur, dur * 0.5);
      const v = c.createOscillator();
      const vg = c.createGain();
      v.frequency.value = 5;
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(10, t + dur * 0.5);
      v.connect(vg).connect(o.detune);
      v.start(t);
      v.stop(t + dur * 2);
    }
    o.frequency.value = freq;
    o.connect(f).connect(g).connect(this.dryIn);
    o.start(t);
    o.stop(t + dur * 2);
  }

  private bell(freq: number, t: number) {
    const c = this.ctx;
    for (const [mul, vol, dec] of [[1, 0.06, 3.5], [2.76, 0.025, 1.8], [5.4, 0.012, 0.9]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = freq * mul;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(this.dryIn);
      o.start(t);
      o.stop(t + dec + 0.05);
    }
  }

  private drum(t: number, vol: number) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.25);
    g.gain.setValueAtTime(0.4 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(this.dryIn);
    o.start(t);
    o.stop(t + 0.7);
    this.noiseHit(t, 0.08, 0.12 * vol, 900, 'lowpass', this.dryIn);
  }

  private tick8(t: number) {
    this.noiseHit(t, 0.05, 0.05, 4000, 'highpass', this.dryIn);
  }

  private heart(t: number, vol: number) {
    const c = this.ctx;
    for (const [dt, k] of [[0, 1], [0.16, 0.7]] as const) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(70, t + dt);
      o.frequency.exponentialRampToValueAtTime(35, t + dt + 0.15);
      g.gain.setValueAtTime(0.5 * vol * k, t + dt);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.25);
      // The heartbeat is a sound effect, not music: it plays even with music off.
      o.connect(g).connect(this.sfx);
      o.start(t + dt);
      o.stop(t + dt + 0.3);
    }
  }

  private noiseHit(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType, out: AudioNode, q = 0.7) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.8);
    s.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------- ambience

  private ambient(kind: AmbientKind, t: number) {
    const c = this.ctx;
    const out = this.sfx;
    switch (kind) {
      case 'crackle':
        for (let i = 0; i < 3 + Math.random() * 4; i++) this.noiseHit(t + Math.random() * 0.5, 0.02 + Math.random() * 0.03, 0.05 + Math.random() * 0.06, 2500 + Math.random() * 3000, 'bandpass', out, 2);
        break;
      case 'wind': {
        const s = c.createBufferSource();
        s.buffer = this.noise;
        s.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 1.5;
        f.frequency.setValueAtTime(300, t);
        f.frequency.linearRampToValueAtTime(700 + Math.random() * 500, t + 2.5);
        f.frequency.linearRampToValueAtTime(250, t + 5);
        const g = c.createGain();
        this.env(g, t, 2, 0.05, 3.5, 1.5);
        s.connect(f).connect(g).connect(out);
        s.start(t);
        s.stop(t + 6);
        break;
      }
      case 'drip': {
        const o = c.createOscillator();
        const g = c.createGain();
        const f0 = 1400 + Math.random() * 900;
        o.type = 'sine';
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.08);
        g.gain.setValueAtTime(0.06, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.15);
        break;
      }
      case 'owl':
        for (const [dt, f] of [[0, 410], [0.5, 380], [0.75, 380]] as const) {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, t + dt);
          o.frequency.linearRampToValueAtTime(f * 0.92, t + dt + 0.3);
          this.env(g, t + dt, 0.05, 0.03, 0.25, 0.1);
          o.connect(g).connect(out);
          o.start(t + dt);
          o.stop(t + dt + 0.45);
        }
        break;
      case 'chains':
        for (let i = 0; i < 5; i++) {
          const tt = t + i * (0.06 + Math.random() * 0.05);
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'square';
          o.frequency.value = 2200 + Math.random() * 1800;
          g.gain.setValueAtTime(0.012, tt);
          g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.08);
          o.connect(g).connect(out);
          o.start(tt);
          o.stop(tt + 0.1);
        }
        break;
      case 'whisper': {
        const s = c.createBufferSource();
        s.buffer = this.noise;
        s.loop = true;
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 8;
        f.frequency.setValueAtTime(900, t);
        f.frequency.linearRampToValueAtTime(1500, t + 0.6);
        f.frequency.linearRampToValueAtTime(700, t + 1.4);
        const g = c.createGain();
        this.env(g, t, 0.4, 0.04, 1.2, 0.5);
        s.connect(f).connect(g).connect(out);
        s.start(t);
        s.stop(t + 2);
        break;
      }
      case 'rumble': {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(48, t);
        o.frequency.linearRampToValueAtTime(30, t + 2.5);
        this.env(g, t, 0.6, 0.18, 2, 1);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 3.2);
        this.noiseHit(t, 2.5, 0.08, 120, 'lowpass', out);
        break;
      }
      case 'bell_far': {
        const f = mtof(this.note(0, 1));
        for (const [mul, vol] of [[1, 0.035], [2.4, 0.012]] as const) {
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'sine';
          o.frequency.value = f * mul;
          g.gain.setValueAtTime(vol, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 4.1);
        }
        break;
      }
    }
  }
}
