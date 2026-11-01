export interface InputHandlers {
  tap(sx: number, sy: number, mouse: boolean, shift: boolean): void;
  doubleTap(sx: number, sy: number, shift: boolean): void;
  command(sx: number, sy: number, shift: boolean): void;
  box(x0: number, y0: number, x1: number, y1: number, shift: boolean, done: boolean): void;
  boxCancel(): void;
  hover(sx: number, sy: number): void;
  pan(dx: number, dy: number): void;
  zoom(sx: number, sy: number, factor: number): void;
  /** Whether a one-finger drag should draw a selection box instead of panning. */
  boxMode(): boolean;
  key(e: KeyboardEvent): void;
  keyState(code: string, down: boolean): void;
}

interface Ptr {
  id: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  t: number;
  mouse: boolean;
  button: number;
}

type Gesture = 'none' | 'pending' | 'pan' | 'box' | 'pinch' | 'done';

const TAP_SLOP = 10;
const LONG_PRESS_MS = 380;
const DOUBLE_TAP_MS = 320;

/** Translates raw pointer events into RTS gestures for both touch and mouse. */
export class Input {
  private ptrs = new Map<number, Ptr>();
  private gesture: Gesture = 'none';
  private longPressTimer = 0;
  private lastTap = { t: 0, x: 0, y: 0 };
  private pinch = { d: 0, mx: 0, my: 0 };
  private shift = false;
  private cleanup: (() => void)[] = [];

  constructor(
    private el: HTMLElement,
    private h: InputHandlers,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void, o?: AddEventListenerOptions) => {
      el.addEventListener(t, f as EventListener, o);
      this.cleanup.push(() => el.removeEventListener(t, f as EventListener));
    };
    on('pointerdown', (e) => this.down(e));
    on('pointermove', (e) => this.move(e));
    on('pointerup', (e) => this.up(e));
    on('pointercancel', (e) => this.cancel(e));
    on('contextmenu', (e) => e.preventDefault());
    on('wheel', (e) => this.wheel(e), { passive: false });
    const kd = (e: KeyboardEvent) => {
      this.shift = e.shiftKey;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      h.keyState(e.code, true);
      h.key(e);
    };
    const ku = (e: KeyboardEvent) => {
      this.shift = e.shiftKey;
      h.keyState(e.code, false);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    this.cleanup.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku));
  }

  destroy() {
    for (const c of this.cleanup) c();
    clearTimeout(this.longPressTimer);
  }

  private local(e: PointerEvent) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private down(e: PointerEvent) {
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    this.shift = e.shiftKey;
    const p = this.local(e);
    const mouse = e.pointerType === 'mouse';
    this.ptrs.set(e.pointerId, { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now(), mouse, button: e.button });
    if (mouse) {
      if (e.button === 2) {
        this.h.command(p.x, p.y, e.shiftKey);
        this.gesture = 'done';
      } else if (e.button === 1) {
        this.gesture = 'pan';
      } else {
        this.gesture = 'pending';
      }
      return;
    }
    if (this.ptrs.size === 1) {
      this.gesture = 'pending';
      clearTimeout(this.longPressTimer);
      this.longPressTimer = window.setTimeout(() => {
        if (this.gesture === 'pending') {
          this.gesture = 'box';
          navigator.vibrate?.(12);
          const q = [...this.ptrs.values()][0];
          if (q) this.h.box(q.sx, q.sy, q.x, q.y, this.shift, false);
        }
      }, LONG_PRESS_MS);
    } else if (this.ptrs.size === 2) {
      clearTimeout(this.longPressTimer);
      if (this.gesture === 'box') this.h.boxCancel();
      this.gesture = 'pinch';
      this.startPinch();
    }
  }

  private startPinch() {
    const [a, b] = [...this.ptrs.values()];
    this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  private move(e: PointerEvent) {
    const p = this.local(e);
    const ptr = this.ptrs.get(e.pointerId);
    if (!ptr) {
      if (e.pointerType === 'mouse') this.h.hover(p.x, p.y);
      return;
    }
    const dx = p.x - ptr.x;
    const dy = p.y - ptr.y;
    ptr.x = p.x;
    ptr.y = p.y;
    if (ptr.mouse) this.h.hover(p.x, p.y);
    const far = Math.hypot(p.x - ptr.sx, p.y - ptr.sy) > (ptr.mouse ? 5 : TAP_SLOP);
    switch (this.gesture) {
      case 'pending':
        if (far) {
          clearTimeout(this.longPressTimer);
          this.gesture = ptr.mouse || this.h.boxMode() ? 'box' : 'pan';
          if (this.gesture === 'pan') this.h.pan(p.x - ptr.sx, p.y - ptr.sy);
          else this.h.box(ptr.sx, ptr.sy, p.x, p.y, this.shift, false);
        }
        break;
      case 'pan':
        this.h.pan(dx, dy);
        break;
      case 'box':
        this.h.box(ptr.sx, ptr.sy, p.x, p.y, this.shift, false);
        break;
      case 'pinch': {
        if (this.ptrs.size < 2) break;
        const [a, b] = [...this.ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        this.h.pan(mx - this.pinch.mx, my - this.pinch.my);
        if (this.pinch.d > 0) this.h.zoom(mx, my, d / this.pinch.d);
        this.pinch = { d, mx, my };
        break;
      }
    }
  }

  private up(e: PointerEvent) {
    const ptr = this.ptrs.get(e.pointerId);
    if (!ptr) return;
    this.ptrs.delete(e.pointerId);
    clearTimeout(this.longPressTimer);
    if (this.gesture === 'pending') {
      const now = performance.now();
      const dbl = now - this.lastTap.t < DOUBLE_TAP_MS && Math.hypot(ptr.x - this.lastTap.x, ptr.y - this.lastTap.y) < 30;
      if (dbl) {
        this.h.doubleTap(ptr.x, ptr.y, e.shiftKey);
        this.lastTap.t = 0;
      } else {
        this.h.tap(ptr.x, ptr.y, ptr.mouse, e.shiftKey);
        this.lastTap = { t: now, x: ptr.x, y: ptr.y };
      }
    } else if (this.gesture === 'box') {
      this.h.box(ptr.sx, ptr.sy, ptr.x, ptr.y, e.shiftKey, true);
    }
    if (this.ptrs.size === 0) this.gesture = 'none';
    else if (this.gesture === 'pinch') this.gesture = 'done';
  }

  private cancel(e: PointerEvent) {
    this.ptrs.delete(e.pointerId);
    clearTimeout(this.longPressTimer);
    if (this.gesture === 'box') this.h.boxCancel();
    if (this.ptrs.size === 0) this.gesture = 'none';
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    const p = this.local(e as unknown as PointerEvent);
    this.h.zoom(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
  }
}
