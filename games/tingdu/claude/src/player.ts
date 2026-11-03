import type { PlayMode } from './settings';
import { charAt, sentenceAt, type Timeline } from './timeline';
import type { Story } from './types';

export interface PlayerState {
  playing: boolean;
  /** the line being read (or the one that will be read next) */
  sentence: number;
  /** index into Timeline.chars of the character being spoken, or -1 */
  char: number;
  /** position and length in ms; for device-voice playback these count lines instead */
  time: number;
  duration: number;
}

export interface Player {
  readonly state: PlayerState;
  /** true when position can be dragged on a time slider (narrated audio) */
  readonly seekable: boolean;
  onChange: (state: PlayerState) => void;
  onEnded: () => void;
  play(): void;
  pause(): void;
  /** jump to a line; keeps playing if it was */
  gotoSentence(i: number, play?: boolean): void;
  /** jump to a word and read on from there */
  playFrom(sentence: number, token: number): void;
  /** say a single word, then stop */
  playWord(sentence: number, token: number): void;
  seek(ms: number): void;
  setRate(rate: number): void;
  setMode(mode: PlayMode): void;
  destroy(): void;
}

const REPEAT_GAP = 900;

// ====================================================================== narrated audio

/** Plays a story's pre-recorded narration and reports which character is being spoken. */
export class AudioPlayer implements Player {
  readonly seekable = true;
  readonly state: PlayerState;
  onChange: (state: PlayerState) => void = () => {};
  onEnded: () => void = () => {};

  private audio: HTMLAudioElement;
  private raf = 0;
  /** stop (or loop) when playback reaches this ms; set for line-by-line modes and single words */
  private stopAt: number | null = null;
  private stopAction: 'pause' | 'loop' | 'word' = 'pause';
  /** after pausing at the end of a line in line-by-line mode, play() starts the next line */
  private resumeAt: number | null = null;
  private loopTimer = 0;
  private mode: PlayMode = 'continuous';

  constructor(
    private story: Story,
    private timeline: Timeline,
    src: string,
  ) {
    this.audio = new Audio(src);
    this.audio.preload = 'auto';
    this.state = { playing: false, sentence: 0, char: -1, time: 0, duration: story.duration ?? 0 };
    this.audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(this.audio.duration)) this.state.duration = this.audio.duration * 1000;
      this.emit();
    });
    this.audio.addEventListener('play', () => this.startLoop());
    this.audio.addEventListener('pause', () => this.tick());
    this.audio.addEventListener('ended', () => {
      this.tick();
      this.onEnded();
    });
    this.setupMediaSession();
  }

  play(): void {
    this.clearLoop();
    if (this.resumeAt != null) {
      const next = this.resumeAt;
      this.resumeAt = null;
      if (next >= this.timeline.sentences.length) return this.gotoSentence(0, true);
      return this.gotoSentence(next, true);
    }
    if (this.audio.ended || this.audio.currentTime * 1000 >= this.state.duration - 50) this.audio.currentTime = 0;
    this.armStop(this.sentenceNow());
    void this.audio.play().catch(() => {
      this.state.playing = false;
      this.emit();
    });
    this.state.playing = true;
    this.emit();
  }

  pause(): void {
    this.clearLoop();
    this.resumeAt = null;
    this.audio.pause();
    this.state.playing = false;
    this.emit();
  }

  gotoSentence(i: number, play = this.state.playing): void {
    i = Math.max(0, Math.min(i, this.timeline.sentences.length - 1));
    const span = this.timeline.sentences[i];
    this.clearLoop();
    this.resumeAt = null;
    this.audio.currentTime = span.start / 1000;
    this.state.sentence = i;
    this.state.char = -1;
    this.state.time = span.start;
    if (play) this.play();
    else this.emit();
  }

  playFrom(sentence: number, token: number): void {
    const tok = this.story.sentences[sentence]?.tokens[token];
    if (tok?.s == null) return this.gotoSentence(sentence, true);
    this.resumeAt = null;
    this.audio.currentTime = Math.max(0, tok.s - 40) / 1000;
    this.state.sentence = sentence;
    this.play();
  }

  playWord(sentence: number, token: number): void {
    const tok = this.story.sentences[sentence]?.tokens[token];
    if (tok?.s == null || tok.e == null) return;
    this.clearLoop();
    this.resumeAt = null;
    this.audio.currentTime = Math.max(0, tok.s - 40) / 1000;
    this.stopAt = tok.e + 60;
    this.stopAction = 'word';
    this.state.sentence = sentence;
    void this.audio.play().catch(() => {});
    this.state.playing = true;
    this.emit();
  }

  seek(ms: number): void {
    this.resumeAt = null;
    this.audio.currentTime = ms / 1000;
    this.state.sentence = sentenceAt(this.timeline, ms);
    if (this.state.playing) this.armStop(this.state.sentence);
    this.tick();
  }

  setRate(rate: number): void {
    this.audio.playbackRate = rate;
    this.audio.defaultPlaybackRate = rate;
  }

  setMode(mode: PlayMode): void {
    this.mode = mode;
    if (this.state.playing && this.stopAction !== 'word') this.armStop(this.state.sentence);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.clearLoop();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }

  private sentenceNow(): number {
    return sentenceAt(this.timeline, this.audio.currentTime * 1000 + 1);
  }

  private clearLoop(): void {
    clearTimeout(this.loopTimer);
    this.loopTimer = 0;
  }

  /** In line-by-line and repeat modes, stop at the end of line `i`. */
  private armStop(i: number): void {
    if (this.mode === 'continuous') {
      this.stopAt = null;
      return;
    }
    this.stopAt = this.timeline.sentences[i].end;
    this.stopAction = this.mode === 'repeat' ? 'loop' : 'pause';
    this.state.sentence = i;
  }

  private startLoop(): void {
    cancelAnimationFrame(this.raf);
    const step = () => {
      this.tick();
      if (!this.audio.paused) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private tick(): void {
    const ms = this.audio.currentTime * 1000;
    if (this.stopAt != null && ms >= this.stopAt && !this.audio.paused) {
      const action = this.stopAction;
      const line = this.state.sentence;
      this.stopAt = null;
      this.audio.pause();
      if (action === 'pause') this.resumeAt = line + 1;
      if (action === 'loop') {
        this.loopTimer = window.setTimeout(() => {
          this.loopTimer = 0;
          this.gotoSentence(line, true);
        }, REPEAT_GAP);
      }
    }
    const looping = this.loopTimer !== 0;
    this.state.playing = !this.audio.paused || looping;
    this.state.time = ms;
    this.state.char = this.audio.paused ? -1 : charAt(this.timeline, ms);
    if (this.resumeAt != null) this.state.sentence = this.resumeAt - 1;
    else if (!looping) this.state.sentence = this.sentenceNow();
    this.emit();
  }

  private emit(): void {
    this.onChange(this.state);
  }

  private setupMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: `${this.story.title} · ${this.story.en}`, artist: '听读 Tīngdú' });
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.gotoSentence(Math.max(0, this.state.sentence - 1)));
      navigator.mediaSession.setActionHandler('nexttrack', () => this.gotoSentence(this.state.sentence + 1));
    } catch {
      /* not supported on this browser */
    }
  }
}

// ====================================================================== device voice

/** Picks the most natural Mandarin voice the device has. */
export function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase();
  const mainland = voices.filter((v) => /^(zh-cn|cmn-hans|cmn-cn|zh-hans)/.test(norm(v)));
  const anyMandarin = mainland.length ? mainland : voices.filter((v) => /^(zh-tw|cmn)/.test(norm(v)));
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced|online/i.test(v.name) ? 4 : 0) +
    (/xiaoxiao|yunxi|tingting|lili|普通话|mandarin/i.test(v.name) ? 2 : 0) +
    (v.localService ? 0 : 1);
  return [...anyMandarin].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Waits (briefly) for the browser's voice list, which loads asynchronously on some browsers. */
export function voicesReady(timeout = 1500): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  if (speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      speechSynthesis.removeEventListener('voiceschanged', done);
      resolve();
    };
    speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, timeout);
  });
}

interface Utterance {
  sentence: number;
  /** the global char indices of the spoken characters, in order */
  chars: number[];
  /** for each UTF-16 offset in the spoken text: how many spoken characters precede it */
  spokenBefore: number[];
  text: string;
}

/**
 * Reads pasted text with the device's own Mandarin voice (Web Speech API), one line at a time.
 * Browsers report word positions as they speak on some platforms only, so the highlight is
 * estimated from elapsed time, learned speaking speed, and any word positions that do arrive.
 */
export class SpeechPlayer implements Player {
  readonly seekable = false;
  readonly state: PlayerState;
  onChange: (state: PlayerState) => void = () => {};
  onEnded: () => void = () => {};

  private lines: Utterance[] = [];
  private mode: PlayMode = 'continuous';
  private rate = 1;
  private voice: SpeechSynthesisVoice | null = null;
  /** characters per second at rate 1, refined after each line */
  private cps = 4.2;
  private boundariesWork = false;
  private session = 0;
  private raf = 0;
  private timer = 0;
  private resumeAt: number | null = null;
  /** progress of the current utterance */
  private started = 0;
  private boundaryPos = 0;
  private boundaryLen = 0;
  private boundaryTime = 0;

  constructor(
    private story: Story,
    timeline: Timeline,
  ) {
    this.state = { playing: false, sentence: 0, char: -1, time: 0, duration: story.sentences.length };
    story.sentences.forEach((s, si) => {
      const span = timeline.sentences[si];
      const chars: number[] = [];
      for (let i = span.first; i <= span.last; i++) chars.push(i);
      let text = '';
      const spokenBefore: number[] = [];
      let n = 0;
      for (const tok of s.tokens) {
        for (const ch of tok.t) {
          for (let k = 0; k < ch.length; k++) spokenBefore.push(n);
          text += ch;
          if (tok.py) n++;
        }
      }
      spokenBefore.push(n);
      this.lines.push({ sentence: si, chars, spokenBefore, text });
    });
    this.voice = pickChineseVoice();
  }

  play(): void {
    let i = this.state.sentence;
    if (this.resumeAt != null) {
      i = this.resumeAt;
      this.resumeAt = null;
    }
    if (i >= this.lines.length) i = 0;
    this.speakLine(i);
  }

  pause(): void {
    this.stop();
    this.state.playing = false;
    this.state.char = -1;
    this.emit();
  }

  gotoSentence(i: number, play = this.state.playing): void {
    i = Math.max(0, Math.min(i, this.lines.length - 1));
    this.resumeAt = null;
    this.stop();
    this.state.sentence = i;
    this.state.char = -1;
    this.state.time = i;
    if (play) this.speakLine(i);
    else this.emit();
  }

  playFrom(sentence: number, _token: number): void {
    this.gotoSentence(sentence, true);
  }

  playWord(sentence: number, token: number): void {
    const tok = this.story.sentences[sentence]?.tokens[token];
    if (!tok?.py) return;
    this.stop();
    const session = ++this.session;
    const u = this.utter(tok.t);
    u.onend = u.onerror = () => {
      if (session !== this.session) return;
      this.state.playing = false;
      this.emit();
    };
    this.state.playing = true;
    this.emit();
    speechSynthesis.speak(u);
  }

  seek(ms: number): void {
    this.gotoSentence(Math.round(ms));
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  setMode(mode: PlayMode): void {
    this.mode = mode;
  }

  destroy(): void {
    this.stop();
  }

  private stop(): void {
    this.session++;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  private utter(text: string): SpeechSynthesisUtterance {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.voice?.lang ?? 'zh-CN';
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate;
    return u;
  }

  private speakLine(i: number): void {
    this.stop();
    if (!('speechSynthesis' in window)) return;
    const line = this.lines[i];
    const session = this.session;
    this.state.sentence = i;
    this.state.time = i;
    this.state.playing = true;
    this.state.char = -1;
    if (!line.chars.length) {
      // nothing to say on this line
      this.timer = window.setTimeout(() => this.lineDone(i, session, 0), 50);
      return;
    }
    const u = this.utter(line.text);
    this.boundaryPos = 0;
    this.boundaryLen = 0;
    u.onstart = () => {
      if (session !== this.session) return;
      this.started = performance.now();
      this.boundaryTime = this.started;
      this.loop(line, session);
    };
    u.onboundary = (e) => {
      if (session !== this.session || e.name === 'sentence') return;
      const pos = line.spokenBefore[Math.min(e.charIndex, line.spokenBefore.length - 1)];
      if (pos > 0) this.boundariesWork = true;
      const len = e.charLength ? line.spokenBefore[Math.min(e.charIndex + e.charLength, line.spokenBefore.length - 1)] - pos : 1;
      this.boundaryPos = pos;
      this.boundaryLen = Math.max(1, len);
      this.boundaryTime = performance.now();
    };
    u.onend = () => {
      if (session !== this.session) return;
      const secs = (performance.now() - this.started) / 1000;
      // learn how fast this voice speaks (ignoring implausible values from cut-off lines)
      if (line.chars.length >= 4 && secs > 0.3) {
        const measured = line.chars.length / secs / this.rate;
        if (measured > 1.5 && measured < 9) this.cps = this.cps * 0.5 + measured * 0.5;
      }
      this.lineDone(i, session, REPEAT_GAP / 2);
    };
    u.onerror = (e) => {
      if (session !== this.session || e.error === 'interrupted' || e.error === 'canceled') return;
      this.state.playing = false;
      this.emit();
    };
    this.emit();
    speechSynthesis.speak(u);
  }

  private lineDone(i: number, session: number, gap: number): void {
    if (session !== this.session) return;
    cancelAnimationFrame(this.raf);
    this.state.char = -1;
    if (this.mode === 'repeat') {
      this.emit();
      this.timer = window.setTimeout(() => this.speakLine(i), REPEAT_GAP);
    } else if (this.mode === 'sentence') {
      this.state.playing = false;
      this.resumeAt = i + 1;
      this.emit();
    } else if (i + 1 < this.lines.length) {
      this.emit();
      this.timer = window.setTimeout(() => this.speakLine(i + 1), gap);
    } else {
      this.state.playing = false;
      this.state.sentence = 0;
      this.emit();
      this.onEnded();
    }
  }

  private loop(line: Utterance, session: number): void {
    const step = () => {
      if (session !== this.session) return;
      const now = performance.now();
      const perSec = this.cps * this.rate;
      let pos: number;
      if (this.boundariesWork) {
        // walk through the reported word at the learned speed, never past its end
        pos = Math.min(this.boundaryPos + Math.floor(((now - this.boundaryTime) / 1000) * perSec), this.boundaryPos + this.boundaryLen - 1);
      } else {
        pos = Math.max(this.boundaryPos, Math.floor(((now - this.started) / 1000) * perSec));
      }
      pos = Math.min(pos, line.chars.length - 1);
      this.state.char = line.chars[pos];
      this.emit();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private emit(): void {
    this.onChange(this.state);
  }
}
