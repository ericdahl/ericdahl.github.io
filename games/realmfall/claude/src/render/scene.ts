import * as THREE from 'three';
import type { World } from '../game/world';
import type { Entity, GameEvent } from '../game/types';
import { ABILITIES } from '../game/data';
import { buildTerrain, buildWater } from './terrain';
import { buildProps } from './props';
import { buildStructures, ownerColor, type KeepView } from './structures';
import { buildRig, animate, attachGlow, schoolColor, type Rig } from './models';

export interface PlateInfo { text: string; sub?: string; color: string; show: boolean }

interface View {
  e: Entity;
  rig: Rig;
  pos: THREE.Vector3;
  facing: number;
  plate?: THREE.Sprite;
  plateKey?: string;
}

interface Fx { obj: THREE.Object3D; t: number; dur: number; update: (f: Fx, k: number) => void; dispose?: () => void }

const DAY = 24 * 60; // seconds per day

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private w: World;
  private views = new Map<number, View>();
  private sun = new THREE.DirectionalLight('#fff3dc', 2.2);
  private hemi = new THREE.HemisphereLight('#bcd6ff', '#5a5040', 1.1);
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private water: THREE.Mesh;
  private keepViews: KeepView[] = [];
  private portals: THREE.Mesh[] = [];
  private ring: THREE.Mesh;
  private fx: Fx[] = [];
  private stars: THREE.Points;
  plateInfo: (e: Entity) => PlateInfo = (e) => ({ text: e.name, color: '#fff', show: true });
  targetColor: (e: Entity) => string = () => '#ffd84a';
  focus = new THREE.Vector3();
  mapCanvas: HTMLCanvasElement | null = null;
  timeOffset = 0.32;

  constructor(canvas: HTMLCanvasElement, w: World) {
    this.w = w;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 2600);
    this.scene.fog = new THREE.Fog('#b9cde0', 140, 900);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 500;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color('#3f7fd6') }, horizon: { value: new THREE.Color('#cfe2f2') },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#fff2c0') },
      },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y, -0.2, 1.0); vec3 c = mix(horizon, top, pow(max(h,0.0), 0.55));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        c += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25);
        if (vDir.y < 0.0) c = mix(horizon, horizon*0.7, clamp(-vDir.y*4.0,0.0,1.0));
        gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), this.skyMat);
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
    // stars
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      sp[i * 3] = Math.cos(a) * r * 1900; sp[i * 3 + 1] = Math.abs(u) * 1900; sp[i * 3 + 2] = Math.sin(a) * r * 1900;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);

    const terrain = buildTerrain(w.geo);
    this.mapCanvas = terrain.userData.map ?? null;
    this.scene.add(terrain);
    this.water = buildWater();
    this.scene.add(this.water);
    this.scene.add(buildProps(w.geo));
    const st = buildStructures(w);
    this.scene.add(st.group);
    this.keepViews = st.keepViews;
    this.portals = st.portals;

    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.renderOrder = 2;
    this.scene.add(this.ring);
  }

  resize(wd: number, ht: number) {
    this.renderer.setSize(wd, ht, false);
    this.camera.aspect = wd / ht;
    this.camera.updateProjectionMatrix();
  }

  /** 0..1 through the day; 0.25 is sunrise, 0.5 noon. */
  dayFrac() {
    return ((this.w.t / DAY) + this.timeOffset) % 1;
  }

  private lighting() {
    const f = this.dayFrac();
    const ang = (f - 0.25) * Math.PI * 2; // 0 at sunrise
    const elev = Math.sin(ang);
    const dir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.max(elev, -0.3), 0.45).normalize();
    const moon = elev < 0;
    const lightDir = moon ? new THREE.Vector3(-dir.x, -dir.y + 0.3, -dir.z).normalize() : dir;
    const day = THREE.MathUtils.smoothstep(elev, -0.15, 0.25);
    const dusk = 1 - Math.abs(THREE.MathUtils.smoothstep(elev, -0.2, 0.35) * 2 - 1);
    this.sun.intensity = moon ? 0.45 : 0.4 + day * 2.0;
    this.sun.color.set(moon ? '#9db4ff' : '#fff3dc').lerp(new THREE.Color('#ff9a5a'), dusk * 0.6);
    this.hemi.intensity = 0.8 + day * 1.0;
    this.hemi.color.set('#5a6c9a').lerp(new THREE.Color('#bcd6ff'), day);
    const top = new THREE.Color('#0b1430').lerp(new THREE.Color('#3f7fd6'), day);
    const hor = new THREE.Color('#1c2640').lerp(new THREE.Color('#cfe2f2'), day).lerp(new THREE.Color('#f0a070'), dusk * 0.55);
    this.skyMat.uniforms.top.value.copy(top);
    this.skyMat.uniforms.horizon.value.copy(hor);
    this.skyMat.uniforms.sunDir.value.copy(dir);
    (this.scene.fog as THREE.Fog).color.copy(hor);
    (this.stars.material as THREE.PointsMaterial).opacity = (1 - day) * 0.9;
    const p = this.focus;
    this.sun.position.set(p.x + lightDir.x * 200, p.y + lightDir.y * 200, p.z + lightDir.z * 200);
    this.sun.target.position.copy(p);
    this.renderer.toneMappingExposure = 0.85 + day * 0.2;
  }

  handle(events: GameEvent[]) {
    for (const ev of events) {
      switch (ev.type) {
        case 'swing': {
          const v = this.views.get(ev.id);
          if (v) v.rig.swingT = 0;
          break;
        }
        case 'castStart': {
          const v = this.views.get(ev.id);
          if (v) {
            v.rig.casting = ev.ab;
            v.rig.castT = 0;
            attachGlow(v.rig, schoolColor(ABILITIES[ev.ab]?.school ?? 'energy'));
          }
          break;
        }
        case 'castEnd': {
          const v = this.views.get(ev.id);
          if (v) v.rig.casting = null;
          break;
        }
        case 'projectile': this.projectile(ev.from, ev.to, ev.school); break;
        case 'aoe': this.aoe(ev.x, ev.z, ev.r, ev.school); break;
        case 'levelup': if (this.w.player) this.pillar(this.w.player, ev.level < 0 ? '#ff6b5a' : '#ffe58a'); break;
        case 'heal': {
          const v = this.views.get(ev.id);
          if (v && ev.amount > 0) this.sparkle(v, '#7dff9a');
          break;
        }
        case 'buff': {
          const v = this.views.get(ev.id);
          if (v) this.sparkle(v, '#9fd0ff');
          break;
        }
        case 'despawn': this.drop(ev.id); break;
      }
    }
  }

  private drop(id: number) {
    const v = this.views.get(id);
    if (!v) return;
    this.scene.remove(v.rig.root);
    if (v.plate) {
      this.scene.remove(v.plate);
      (v.plate.material as THREE.SpriteMaterial).map?.dispose();
      v.plate.material.dispose();
    }
    v.rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
    });
    this.views.delete(id);
  }

  private projectile(from: number, to: number, school: string) {
    const a = this.views.get(from), b = this.views.get(to);
    if (!a || !b) return;
    const col = schoolColor(school);
    const arrow = school === 'arrow' || school === 'ranged';
    const g = arrow ? new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4).rotateZ(Math.PI / 2) : new THREE.IcosahedronGeometry(0.28, 1);
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: arrow ? 1 : 0.9 });
    const o = new THREE.Mesh(g, m);
    const start = a.pos.clone().add(new THREE.Vector3(0, a.rig.height * 0.7, 0));
    const d = start.distanceTo(b.pos);
    this.scene.add(o);
    this.fx.push({
      obj: o, t: 0, dur: Math.max(0.12, d / (arrow ? 60 : 38)),
      update: (_f, k) => {
        const end = b.pos.clone().add(new THREE.Vector3(0, b.rig.height * 0.55, 0));
        o.position.lerpVectors(start, end, k);
        o.position.y += Math.sin(k * Math.PI) * (arrow ? d * 0.04 : 0.3);
        o.lookAt(end);
        if (arrow) o.rotateY(Math.PI / 2);
      },
      dispose: () => { g.dispose(); m.dispose(); },
    });
  }

  private aoe(x: number, z: number, r: number, school: string) {
    const col = schoolColor(school);
    const g = new THREE.RingGeometry(0.6, 1, 40).rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    const o = new THREE.Mesh(g, m);
    o.position.set(x, this.w.geo.standY(x, z) + 0.3, z);
    this.scene.add(o);
    this.fx.push({
      obj: o, t: 0, dur: 0.7,
      update: (_f, k) => { o.scale.setScalar(0.3 + k * r); m.opacity = 0.85 * (1 - k); },
      dispose: () => { g.dispose(); m.dispose(); },
    });
  }

  private pillar(e: Entity, col: string) {
    const g = new THREE.CylinderGeometry(1.2, 1.2, 14, 16, 1, true);
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const o = new THREE.Mesh(g, m);
    this.scene.add(o);
    this.fx.push({
      obj: o, t: 0, dur: 2.2,
      update: (_f, k) => { o.position.set(e.x, e.y + 7, e.z); o.scale.set(1 + k, 1, 1 + k); m.opacity = 0.55 * (1 - k); },
      dispose: () => { g.dispose(); m.dispose(); },
    });
  }

  private sparkle(v: View, col: string) {
    const n = 14;
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: col, size: 0.25, transparent: true, opacity: 1, depthWrite: false });
    const o = new THREE.Points(g, m);
    const seeds = Array.from({ length: n }, () => [Math.random() * Math.PI * 2, Math.random() * 0.8 + 0.3, Math.random()]);
    this.scene.add(o);
    this.fx.push({
      obj: o, t: 0, dur: 1,
      update: (_f, k) => {
        for (let i = 0; i < n; i++) {
          const [a, r, y] = seeds[i];
          pos[i * 3] = v.pos.x + Math.cos(a + k * 3) * r;
          pos[i * 3 + 1] = v.pos.y + y * v.rig.height + k * 1.5;
          pos[i * 3 + 2] = v.pos.z + Math.sin(a + k * 3) * r;
        }
        g.attributes.position.needsUpdate = true;
        m.opacity = 1 - k;
      },
      dispose: () => { g.dispose(); m.dispose(); },
    });
  }

  private makePlate(info: PlateInfo): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 44px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.fillStyle = info.color;
    const y = info.sub ? 58 : 80;
    ctx.strokeText(info.text, 256, y);
    ctx.fillText(info.text, 256, y);
    if (info.sub) {
      ctx.font = 'italic 32px Georgia, serif';
      ctx.fillStyle = '#e6dcc4';
      ctx.strokeText(info.sub, 256, 104);
      ctx.fillText(info.sub, 256, 104);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.scale.set(4, 1, 1);
    sp.renderOrder = 3;
    return sp;
  }

  render(dt: number) {
    const w = this.w;
    const now = w.t;
    const cam = this.camera.position;
    const p = w.player;
    const tgt = p ? w.get(p.target) : undefined;
    const seen = new Set<number>();
    const smooth = 1 - Math.exp(-dt * 18);
    for (const e of w.list) {
      const dx = e.x - cam.x, dz = e.z - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 200 * 200 && e !== p && e !== tgt) continue;
      if (e.kind === 'door') continue;
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        const rig = buildRig(e);
        v = { e, rig, pos: new THREE.Vector3(e.x, e.y, e.z), facing: e.facing };
        this.views.set(e.id, v);
        this.scene.add(rig.root);
      }
      const before = v.pos.clone();
      if (v.pos.distanceToSquared(new THREE.Vector3(e.x, e.y, e.z)) > 100) v.pos.set(e.x, e.y, e.z);
      else v.pos.lerp(new THREE.Vector3(e.x, e.y, e.z), e === p ? Math.min(1, smooth * 1.6) : smooth);
      let df = e.facing - v.facing;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      v.facing += df * Math.min(1, smooth * 1.4);
      v.rig.root.position.copy(v.pos);
      v.rig.root.rotation.y = -v.facing;
      const moved = Math.hypot(v.pos.x - before.x, v.pos.z - before.z);
      if (d2 < 110 * 110 || e === p) animate(v.rig, e, dt, moved, now);
      v.rig.root.visible = !(e === p && this.hidePlayer);
      // nameplates
      const near = d2 < 45 * 45 || e === tgt;
      const info = near && e !== p ? this.plateInfo(e) : null;
      if (info && info.show && !e.dead) {
        const key = `${info.text}|${info.sub}|${info.color}`;
        if (v.plateKey !== key) {
          if (v.plate) { this.scene.remove(v.plate); (v.plate.material as THREE.SpriteMaterial).map?.dispose(); v.plate.material.dispose(); }
          v.plate = this.makePlate(info);
          v.plateKey = key;
          this.scene.add(v.plate);
        }
        const pl = v.plate!;
        pl.visible = true;
        pl.position.set(v.pos.x, v.pos.y + v.rig.height + 0.45, v.pos.z);
        const s = Math.max(1, Math.sqrt(d2) / 14);
        pl.scale.set(2.6 * s, 0.65 * s, 1);
      } else if (v.plate) v.plate.visible = false;
    }
    for (const id of [...this.views.keys()]) if (!seen.has(id)) this.drop(id);
    // target ring
    if (tgt && !tgt.dead) {
      const tv = this.views.get(tgt.id);
      const pos = tv ? tv.pos : new THREE.Vector3(tgt.x, tgt.y, tgt.z);
      this.ring.visible = true;
      this.ring.position.set(pos.x, w.geo.standY(pos.x, pos.z) + 0.12, pos.z);
      this.ring.scale.setScalar(Math.max(0.9, tgt.radius * 1.9));
      (this.ring.material as THREE.MeshBasicMaterial).color.set(this.targetColor(tgt));
    } else this.ring.visible = false;
    // keeps
    this.keepViews.forEach((kv, i) => {
      const k = w.keeps[i];
      const col = ownerColor(k.owner);
      if ('#' + kv.roofMat.color.getHexString() !== col.toLowerCase()) {
        kv.roofMat.color.set(col);
        kv.flagMat.color.set(col);
      }
      const door = w.get(k.doorId);
      const open = !door || door.dead;
      kv.door.visible = !open;
      kv.rubble.visible = open;
      for (const b of kv.banners) if (b.userData.wave) b.rotation.x = Math.sin(now * 2 + i) * 0.15;
    });
    for (const pm of this.portals) pm.rotation.z += dt * 0.8;
    // effects
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      f.update(f, k);
      if (k >= 1) {
        this.scene.remove(f.obj);
        f.dispose?.();
        this.fx.splice(i, 1);
      }
    }
    (this.water.material as THREE.MeshPhongMaterial).opacity = 0.74 + Math.sin(now * 0.7) * 0.03;
    this.sky.position.copy(cam);
    this.stars.position.copy(cam);
    this.lighting();
    this.renderer.render(this.scene, this.camera);
  }

  hidePlayer = false;

  /** Screen-space position of an entity's head, for floating text. */
  project(id: number, out: { x: number; y: number }, lift = 0.2): boolean {
    const v = this.views.get(id);
    if (!v) return false;
    const p = new THREE.Vector3(v.pos.x, v.pos.y + v.rig.height + lift, v.pos.z).project(this.camera);
    if (p.z > 1) return false;
    const el = this.renderer.domElement;
    out.x = ((p.x + 1) / 2) * el.clientWidth;
    out.y = ((1 - p.y) / 2) * el.clientHeight;
    return true;
  }

  /** The entity under a screen point, if any. */
  pick(sx: number, sy: number): number | null {
    const el = this.renderer.domElement;
    let best: number | null = null, bd = 1e9;
    const v3 = new THREE.Vector3();
    for (const v of this.views.values()) {
      if (v.e === this.w.player) continue;
      const camD = v.pos.distanceTo(this.camera.position);
      if (camD > 150) continue;
      for (const f of [0.2, 0.5, 0.85]) {
        v3.set(v.pos.x, v.pos.y + v.rig.height * f, v.pos.z).project(this.camera);
        if (v3.z > 1) continue;
        const x = ((v3.x + 1) / 2) * el.clientWidth, y = ((1 - v3.y) / 2) * el.clientHeight;
        const r = Math.max(14, (v.rig.height * 0.5 * el.clientHeight) / (camD * 1.15));
        const d = Math.hypot(x - sx, y - sy);
        if (d < r && camD + d * 0.05 < bd) { bd = camD + d * 0.05; best = v.e.id; }
      }
    }
    return best;
  }
}
