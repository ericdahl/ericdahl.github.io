/** Ability icons, drawn on a canvas once and cached as data URLs. */
const cache = new Map<string, string>();

const BG: Record<string, [string, string]> = {
  melee: ['#6b5a48', '#2a2018'], ranged: ['#4f6a3a', '#1c2614'], fire: ['#b8431c', '#3a1006'], cold: ['#3d7fb0', '#0e2234'],
  energy: ['#6a4bb0', '#1e1236'], holy: ['#c9a23a', '#3a2a08'], potion: ['#7a2030', '#2a0810'], potion2: ['#203a7a', '#08102a'],
};

export function iconUrl(key: string, school: string): string {
  const id = key + '|' + school;
  let u = cache.get(id);
  if (u) return u;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const [a, b] = BG[school] ?? BG.melee;
  const grad = g.createRadialGradient(24, 20, 4, 32, 32, 46);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#f3e6c4';
  g.fillStyle = '#f3e6c4';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g, key);
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 61, 61);
  u = c.toDataURL();
  cache.set(id, u);
  return u;
}

function line(g: CanvasRenderingContext2D, pts: number[]) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}
function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill = false) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) g.fill();
  else g.stroke();
}

function sword(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  line(g, [x0, y0, x1, y1]);
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
  const nx = -dy / l, ny = dx / l;
  const gx = x0 + dx * 0.2, gy = y0 + dy * 0.2;
  line(g, [gx + nx * 9, gy + ny * 9, gx - nx * 9, gy - ny * 9]);
}

function draw(g: CanvasRenderingContext2D, key: string) {
  switch (key) {
    case 'sword': sword(g, 16, 48, 50, 14); break;
    case 'riposte': sword(g, 14, 50, 50, 14); g.lineWidth = 3; line(g, [50, 34, 40, 44, 30, 40]); line(g, [30, 40, 33, 33]); break;
    case 'chain': sword(g, 14, 48, 44, 18); g.lineWidth = 3; circle(g, 46, 44, 6); circle(g, 38, 50, 6); break;
    case 'axe': line(g, [18, 50, 44, 18]); g.beginPath(); g.moveTo(38, 12); g.quadraticCurveTo(56, 18, 52, 34); g.lineTo(40, 24); g.closePath(); g.fill(); break;
    case 'flank': sword(g, 12, 32, 52, 32); line(g, [44, 18, 52, 12]); line(g, [44, 46, 52, 52]); break;
    case 'shield': g.beginPath(); g.moveTo(32, 10); g.lineTo(50, 18); g.quadraticCurveTo(50, 44, 32, 54); g.quadraticCurveTo(14, 44, 14, 18); g.closePath(); g.stroke(); line(g, [32, 18, 32, 46]); break;
    case 'banner': line(g, [20, 54, 20, 10]); g.beginPath(); g.moveTo(20, 12); g.lineTo(48, 16); g.lineTo(40, 26); g.lineTo(48, 36); g.lineTo(20, 32); g.closePath(); g.fill(); break;
    case 'horn': g.beginPath(); g.moveTo(14, 24); g.quadraticCurveTo(40, 22, 50, 40); g.lineTo(42, 46); g.quadraticCurveTo(36, 32, 14, 34); g.closePath(); g.fill(); line(g, [52, 18, 56, 14]); line(g, [54, 28, 60, 26]); break;
    case 'arrow': line(g, [12, 52, 50, 14]); g.beginPath(); g.moveTo(52, 12); g.lineTo(40, 16); g.lineTo(48, 24); g.closePath(); g.fill(); line(g, [12, 52, 10, 44]); line(g, [12, 52, 20, 54]); break;
    case 'snarearrow': draw(g, 'arrow'); g.lineWidth = 3; circle(g, 22, 22, 8); break;
    case 'quick': draw(g, 'arrow'); g.lineWidth = 2; line(g, [8, 30, 24, 30]); line(g, [12, 38, 26, 38]); break;
    case 'crit': draw(g, 'arrow'); g.lineWidth = 2; circle(g, 46, 18, 12); circle(g, 46, 18, 4, true); break;
    case 'volley': g.lineWidth = 3; for (const o of [-12, 0, 12]) line(g, [32 + o, 10, 32 + o, 46]); for (const o of [-12, 0, 12]) { g.beginPath(); g.moveTo(32 + o, 54); g.lineTo(26 + o, 44); g.lineTo(38 + o, 44); g.closePath(); g.fill(); } break;
    case 'wind': g.lineWidth = 4; for (const y of [20, 32, 44]) { g.beginPath(); g.moveTo(12, y); g.quadraticCurveTo(36, y - 10, 52, y); g.stroke(); } break;
    case 'fire': g.beginPath(); g.moveTo(32, 8); g.quadraticCurveTo(50, 28, 44, 44); g.quadraticCurveTo(40, 56, 32, 56); g.quadraticCurveTo(20, 56, 18, 42); g.quadraticCurveTo(18, 30, 28, 22); g.quadraticCurveTo(28, 34, 34, 34); g.quadraticCurveTo(34, 20, 32, 8); g.fill(); break;
    case 'frost': g.lineWidth = 3; for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; line(g, [32 - Math.cos(a) * 22, 32 - Math.sin(a) * 22, 32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22]); } circle(g, 32, 32, 5, true); break;
    case 'root': g.lineWidth = 3; line(g, [32, 10, 32, 34]); g.beginPath(); g.moveTo(32, 34); g.quadraticCurveTo(18, 40, 12, 54); g.moveTo(32, 34); g.quadraticCurveTo(46, 40, 52, 54); g.moveTo(32, 34); g.lineTo(32, 56); g.stroke(); line(g, [10, 56, 54, 56]); break;
    case 'eye': g.beginPath(); g.moveTo(8, 32); g.quadraticCurveTo(32, 10, 56, 32); g.quadraticCurveTo(32, 54, 8, 32); g.stroke(); circle(g, 32, 32, 7, true); break;
    case 'ward': g.lineWidth = 3; circle(g, 32, 32, 22); circle(g, 32, 32, 13); line(g, [32, 10, 32, 54]); line(g, [10, 32, 54, 32]); break;
    case 'ring': g.lineWidth = 5; circle(g, 32, 34, 18); g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; line(g, [32 + Math.cos(a) * 20, 34 + Math.sin(a) * 20, 32 + Math.cos(a) * 28, 34 + Math.sin(a) * 28]); } break;
    case 'bolt': g.beginPath(); g.moveTo(36, 6); g.lineTo(18, 36); g.lineTo(30, 36); g.lineTo(24, 58); g.lineTo(46, 26); g.lineTo(34, 26); g.closePath(); g.fill(); break;
    case 'meteor': circle(g, 40, 40, 12, true); g.lineWidth = 3; line(g, [10, 10, 30, 30]); line(g, [20, 8, 34, 24]); line(g, [8, 20, 24, 34]); break;
    case 'sun': circle(g, 32, 32, 10, true); g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; line(g, [32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15, 32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24]); } break;
    case 'heart': case 'bigheart': {
      const s = key === 'bigheart' ? 1.25 : 1;
      g.save(); g.translate(32, 34); g.scale(s, s);
      g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-22, 0, -14, -20, 0, -8); g.bezierCurveTo(14, -20, 22, 0, 0, 14); g.fill(); g.restore();
      if (key === 'bigheart') { g.fillStyle = '#3a2a08'; g.fillRect(29, 24, 6, 18); g.fillRect(23, 30, 18, 6); }
      break;
    }
    case 'renew': g.lineWidth = 4; g.beginPath(); g.arc(32, 32, 18, 0.3, Math.PI * 1.7); g.stroke(); g.beginPath(); g.moveTo(48, 14); g.lineTo(50, 28); g.lineTo(38, 24); g.closePath(); g.fill(); break;
    case 'bless': line(g, [32, 10, 32, 54]); line(g, [18, 24, 46, 24]); g.lineWidth = 2; circle(g, 32, 24, 18); break;
    case 'stun': g.lineWidth = 3; for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; const x = 32 + Math.cos(a) * 16, y = 32 + Math.sin(a) * 16; line(g, [x - 4, y, x + 4, y]); line(g, [x, y - 4, x, y + 4]); } break;
    case 'sanct': g.lineWidth = 3; g.beginPath(); g.moveTo(10, 50); g.lineTo(32, 12); g.lineTo(54, 50); g.stroke(); line(g, [32, 22, 32, 44]); line(g, [24, 32, 40, 32]); break;
    case 'fangs': g.beginPath(); g.moveTo(16, 16); g.lineTo(26, 48); g.lineTo(30, 16); g.closePath(); g.fill(); g.beginPath(); g.moveTo(34, 16); g.lineTo(38, 48); g.lineTo(48, 16); g.closePath(); g.fill(); break;
    case 'potion': case 'potion2': g.beginPath(); g.moveTo(26, 10); g.lineTo(38, 10); g.lineTo(38, 22); g.quadraticCurveTo(52, 30, 48, 44); g.quadraticCurveTo(44, 56, 32, 56); g.quadraticCurveTo(20, 56, 16, 44); g.quadraticCurveTo(12, 30, 26, 22); g.closePath(); g.stroke(); g.fillStyle = key === 'potion' ? '#ff5a6a' : '#5a8aff'; g.beginPath(); g.arc(32, 42, 12, 0, Math.PI); g.fill(); break;
    case 'attack': sword(g, 14, 50, 50, 14); sword(g, 50, 50, 14, 14); break;
    default: circle(g, 32, 32, 14);
  }
}
