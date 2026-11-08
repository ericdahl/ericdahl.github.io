export const TILE_W = 64;
export const TILE_H = 32;

/** 2:1 isometric camera. World units are tiles; screen units are CSS pixels. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  w = 800;
  h = 600;
  shake = 0;
  private sx = 0;
  private sy = 0;

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    // Aim for roughly the same field of view on phones and desktops.
    const short = Math.min(w, h);
    this.zoom = Math.max(0.75, Math.min(1.5, short / 420));
  }

  follow(x: number, y: number, dt: number) {
    const k = 1 - Math.pow(0.0005, dt);
    this.x += (x - this.x) * k;
    this.y += (y - this.y) * k;
    if (Math.hypot(x - this.x, y - this.y) > 8) {
      this.x = x;
      this.y = y;
    }
    this.shake *= Math.pow(0.002, dt);
    this.sx = (Math.random() - 0.5) * this.shake;
    this.sy = (Math.random() - 0.5) * this.shake;
  }

  snap(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  toScreen(wx: number, wy: number): { x: number; y: number } {
    const z = this.zoom;
    return {
      x: ((wx - this.x) - (wy - this.y)) * (TILE_W / 2) * z + this.w / 2 + this.sx,
      y: ((wx - this.x) + (wy - this.y)) * (TILE_H / 2) * z + this.h / 2 + this.sy,
    };
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    const z = this.zoom;
    const a = (sx - this.w / 2 - this.sx) / ((TILE_W / 2) * z);
    const b = (sy - this.h / 2 - this.sy) / ((TILE_H / 2) * z);
    return { x: (a + b) / 2 + this.x, y: (b - a) / 2 + this.y };
  }

  /** World-space bounding box of the viewport, padded by `pad` tiles. */
  bounds(pad: number) {
    const c = [this.toWorld(0, 0), this.toWorld(this.w, 0), this.toWorld(0, this.h), this.toWorld(this.w, this.h)];
    return {
      x0: Math.floor(Math.min(...c.map((p) => p.x)) - pad),
      x1: Math.ceil(Math.max(...c.map((p) => p.x)) + pad),
      y0: Math.floor(Math.min(...c.map((p) => p.y)) - pad),
      y1: Math.ceil(Math.max(...c.map((p) => p.y)) + pad),
    };
  }
}
