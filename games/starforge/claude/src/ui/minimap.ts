import { HUMAN } from '../game/world';
import { CRYSTAL, FLUX, TEAM } from '../render/colors';
import type { Game } from './game';

/** Overview map: shows explored terrain, visible entities and the camera; tap/drag to jump. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private pings: { x: number; y: number; t: number }[] = [];
  private size = 120;
  private dpr = 1;

  constructor(
    private game: Game,
    private canvas: HTMLCanvasElement,
  ) {
    this.ctx = canvas.getContext('2d')!;
    const w = game.world;
    this.base = document.createElement('canvas');
    this.base.width = w.w * 2;
    this.base.height = w.h * 2;
    this.base.getContext('2d')!.drawImage(game.renderer.terrainCanvas, 0, 0, w.w * 2, w.h * 2);

    let dragging = false;
    const go = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * w.w;
      const y = ((e.clientY - r.top) / r.height) * w.h;
      return { x, y };
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      game.audio.unlock();
      const p = go(e);
      const m = game.mode.type;
      if (m === 'attack' || m === 'rally') {
        game.tapWorld(p.x, p.y, false, false);
        return;
      }
      if (e.button === 2) {
        game.smart(p.x, p.y);
        return;
      }
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      game.cam.centerOn(p.x, p.y);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const p = go(e);
      game.cam.centerOn(p.x, p.y);
    });
    const end = () => (dragging = false);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.size = Math.max(60, Math.round(r.width || 120));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.size * this.dpr;
    this.canvas.height = this.size * this.dpr;
  }

  ping(x: number, y: number) {
    this.pings.push({ x, y, t: performance.now() });
  }

  draw() {
    const { ctx } = this;
    const g = this.game;
    const w = g.world;
    const s = (this.size * this.dpr) / w.w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.drawImage(this.base, 0, 0, w.w, w.h);
    const vis = w.players[HUMAN].vis;
    for (const e of w.list) {
      if (e.dead || !w.isVisibleTo(e, HUMAN)) continue;
      if (e.cls === 'resource') {
        ctx.fillStyle = e.kind === 'crystal' ? CRYSTAL : FLUX;
        ctx.fillRect(e.tx, e.ty, e.w, e.h);
      } else if (e.cls === 'building') {
        ctx.fillStyle = TEAM[e.owner];
        ctx.fillRect(e.tx, e.ty, e.w, e.h);
      } else {
        ctx.fillStyle = TEAM[e.owner];
        ctx.fillRect(e.x - 0.75, e.y - 0.75, 1.5, 1.5);
      }
    }
    // fog
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    for (let y = 0; y < w.h; y++) {
      let run = -1;
      let runV = -1;
      for (let x = 0; x <= w.w; x++) {
        const v = x < w.w ? vis[y * w.w + x] : -1;
        const fogged = v === 2 ? -1 : v;
        if (fogged !== runV) {
          if (runV >= 0) {
            ctx.fillStyle = runV === 0 ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.5)';
            ctx.fillRect(run, y, x - run, 1);
          }
          run = x;
          runV = fogged;
        }
      }
    }
    const now = performance.now();
    this.pings = this.pings.filter((p) => now - p.t < 3000);
    for (const p of this.pings) {
      const a = ((now - p.t) % 1000) / 1000;
      ctx.strokeStyle = `rgba(255,60,60,${1 - a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + a * 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    const b = g.cam.bounds();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
}
