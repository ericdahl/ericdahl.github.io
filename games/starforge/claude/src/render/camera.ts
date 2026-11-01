import { clamp } from '../game/world';

/** View transform. (x, y) is the world tile at the top-left of the screen; zoom is CSS px per tile. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 32;
  minZoom = 14;
  maxZoom = 72;
  viewW = 800;
  viewH = 600;
  /** Screen-space padding (CSS px) covered by HUD panels; the camera may scroll past map edges by this much. */
  padTop = 0;
  padBottom = 0;

  constructor(
    public mapW: number,
    public mapH: number,
  ) {}

  resize(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
    this.clampToMap();
  }

  toScreen(wx: number, wy: number) {
    return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom };
  }

  toWorld(sx: number, sy: number) {
    return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y };
  }

  centerOn(wx: number, wy: number) {
    const usableH = this.viewH - this.padTop - this.padBottom;
    this.x = wx - this.viewW / 2 / this.zoom;
    this.y = wy - (this.padTop + usableH / 2) / this.zoom;
    this.clampToMap();
  }

  panBy(dsx: number, dsy: number) {
    this.x -= dsx / this.zoom;
    this.y -= dsy / this.zoom;
    this.clampToMap();
  }

  zoomAt(sx: number, sy: number, factor: number) {
    const before = this.toWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.x = before.x - sx / this.zoom;
    this.y = before.y - sy / this.zoom;
    this.clampToMap();
  }

  clampToMap() {
    const vw = this.viewW / this.zoom;
    const vh = this.viewH / this.zoom;
    const padT = this.padTop / this.zoom;
    const padB = this.padBottom / this.zoom;
    const minX = -1;
    const maxX = this.mapW + 1 - vw;
    const minY = -1 - padT;
    const maxY = this.mapH + 1 + padB - vh;
    this.x = maxX < minX ? (this.mapW - vw) / 2 : clamp(this.x, minX, maxX);
    this.y = maxY < minY ? (this.mapH - vh) / 2 : clamp(this.y, minY, maxY);
  }

  /** Visible world rectangle. */
  bounds() {
    return { x0: this.x, y0: this.y, x1: this.x + this.viewW / this.zoom, y1: this.y + this.viewH / this.zoom };
  }
}
