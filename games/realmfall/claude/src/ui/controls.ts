/** Keyboard and mouse: MMO-style movement and an orbiting third-person camera. */
import * as THREE from 'three';
import type { World } from '../game/world';

export interface Bindings {
  onClick(x: number, y: number, button: number): void;
  onKey(code: string, e: KeyboardEvent): boolean; // true = handled
}

export class Controls {
  yaw = 0;
  pitch = 0.32;
  distance = 9;
  private keys = new Set<string>();
  private dragL = false;
  private dragR = false;
  private dragMoved = 0;
  autorun = false;
  private follow = true;
  enabled = true;
  private w: World;
  private canvas: HTMLCanvasElement;
  private b: Bindings;

  constructor(canvas: HTMLCanvasElement, w: World, b: Bindings) {
    this.w = w;
    this.canvas = canvas;
    this.b = b;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.dragL = true;
      if (e.button === 2) this.dragR = true;
      this.dragMoved = 0;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.dragL = false;
      if (e.button === 2) this.dragR = false;
      if (this.enabled && e.target === canvas && this.dragMoved < 5) this.b.onClick(e.clientX, e.clientY, e.button);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragL && !this.dragR) return;
      this.dragMoved += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (this.dragMoved < 5) return;
      this.yaw += e.movementX * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * 0.005, -0.5, 1.35);
      if (this.dragL) this.follow = false;
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.distance = THREE.MathUtils.clamp(this.distance * (1 + Math.sign(e.deltaY) * 0.12), 2.5, 34);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (!this.enabled) return;
      if (this.b.onKey(e.code, e)) {
        e.preventDefault();
        return;
      }
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.keys.add(e.code);
        if (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'ArrowUp' || e.code === 'ArrowDown') this.autorun = false;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.dragL = this.dragR = false; });
  }

  private down(...codes: string[]) {
    return codes.some((c) => this.keys.has(c));
  }

  /** Reads input into world.input and turns the hero. */
  update(dt: number) {
    const w = this.w;
    const p = w.player;
    const inp = w.input;
    inp.mx = inp.mz = 0;
    inp.jump = this.down('Space');
    inp.sprint = this.down('ShiftLeft', 'ShiftRight');
    inp.face = null;
    if (!p || p.dead || !this.enabled) return;
    let fwd = 0, strafe = 0;
    if (this.down('KeyW', 'ArrowUp') || this.autorun || (this.dragL && this.dragR)) fwd += 1;
    if (this.down('KeyS', 'ArrowDown')) fwd -= 1;
    if (this.down('KeyQ')) strafe -= 1;
    if (this.down('KeyE')) strafe += 1;
    const turn = (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
    if (this.dragR) {
      strafe += turn;
      p.facing = this.yaw;
      inp.face = this.yaw;
    } else if (turn) {
      p.facing += turn * 2.6 * dt;
      inp.face = p.facing;
      if (this.follow || !this.dragL) this.yaw += turn * 2.6 * dt;
    }
    if (fwd || strafe) {
      if (!this.dragR && !this.dragL) this.follow = true;
      const f = p.facing;
      let mx = Math.cos(f) * fwd - Math.sin(f) * strafe;
      let mz = Math.sin(f) * fwd + Math.cos(f) * strafe;
      const l = Math.hypot(mx, mz);
      mx /= l;
      mz /= l;
      const sp = fwd < 0 && !strafe ? 0.6 : 1;
      inp.mx = mx * sp;
      inp.mz = mz * sp;
      inp.face = inp.face ?? p.facing;
    }
    // camera eases behind the hero while moving, unless the player is looking around
    if (this.follow && !this.dragL && !this.dragR && (fwd || turn)) {
      let d = p.facing - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * 3);
    }
  }

  /** Places the camera behind the focus point, clear of the ground. */
  place(cam: THREE.PerspectiveCamera, fx: number, fy: number, fz: number) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let d = this.distance;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < 6; i++) {
      x = fx - Math.cos(this.yaw) * cp * d;
      z = fz - Math.sin(this.yaw) * cp * d;
      y = fy + sp * d;
      const g = this.w.geo.standY(x, z) + 0.6;
      if (y >= g) break;
      if (this.pitch < 0) { y = g; break; }
      d *= 0.8;
    }
    y = Math.max(y, this.w.geo.standY(x, z) + 0.6);
    cam.position.set(x, y, z);
    cam.lookAt(fx, fy + 0.2, fz);
  }

  snapBehind() {
    const p = this.w.player;
    if (p) this.yaw = p.facing;
    this.follow = true;
  }

  get rightDrag() {
    return this.dragR;
  }
  void() {
    return this.canvas;
  }
}
