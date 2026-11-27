import './style.css';
import { World, dist } from './game/world';
import type { CharSave, Entity } from './game/types';
import { ABILITIES, CON_HEX, conColor, CLASSES, MAX_LEVEL, type ClassId } from './game/data';
import { REALM_DEFS, KEEPS, type RealmId } from './game/geo';
import { makeItem, SLOTS } from './game/items';
import { Rng } from './game/rng';
import { Renderer } from './render/scene';
import { Controls } from './ui/controls';
import { Hud } from './ui/hud';
import { Panels } from './ui/panels';
import { Title } from './ui/title';
import { saveChar, loadSettings, saveSettings } from './ui/save';
import { setMuted, sfx } from './ui/audio';

const params = new URLSearchParams(location.search);
const seed = +(params.get('seed') ?? 7);
const app = document.getElementById('app')!;
const canvas = document.getElementById('view') as HTMLCanvasElement;
const loading = document.getElementById('loading')!;

function boot() {
  const world = new World(seed);
  world.run(25); // let the first warbands march out
  world.logs.length = 0;
  const renderer = new Renderer(canvas, world);
  const hud = new Hud(app, world, renderer);
  const panels = new Panels(app, world, renderer, hud);
  const title = new Title(app);
  const settings = loadSettings();
  panels.settings = settings;
  setMuted(settings.muted);
  const applyShadows = () => {
    renderer.renderer.shadowMap.enabled = settings.shadows;
    renderer.scene.traverse((o) => {
      const m = (o as unknown as { material?: { needsUpdate: boolean } }).material;
      if (m && 'needsUpdate' in m) m.needsUpdate = true;
    });
  };
  applyShadows();
  // Frame rate readout: ?fps in the URL, or Menu → Show frame rate.
  const fpsEl = document.createElement('div');
  fpsEl.id = 'fps';
  app.appendChild(fpsEl);
  if (params.has('fps')) settings.fps = true;
  const showFps = () => { fpsEl.style.display = settings.fps ? 'block' : 'none'; };
  showFps();
  const fpsStats = { frames: 0, time: 0, worst: 0 };
  panels.onSettings = (k, v) => {
    if (k === 'fps') showFps();
    if (k === 'muted') setMuted(v);
    if (k === 'shadows') applyShadows();
    saveSettings(settings);
  };

  renderer.plateInfo = (e: Entity) => {
    const p = world.player;
    if (!p) return { text: e.name, color: '#fff', show: e.kind !== 'mob' };
    if (e.kind === 'mob') return { text: e.named ? e.name : e.name, color: CON_HEX[conColor(p.level, e.level)], show: true };
    if (e.kind === 'npc') return { text: e.name.split(' the ')[0], sub: `<${e.name.split(' the ')[1] ?? ''}>`, color: '#a6e3a1', show: true };
    if (e.realm === p.realm) return { text: e.name, sub: e.kind === 'soldier' ? `<${REALM_DEFS[e.realm as number].name} Warband>` : undefined, color: '#8fd7ff', show: true };
    const realmName = e.realm === -1 ? 'Mistborn' : REALM_DEFS[e.realm as number].name;
    return { text: e.name, sub: e.kind === 'soldier' || e.kind === 'adventurer' ? `<${realmName} ${e.cls ? CLASSES[e.cls].name : ''}>` : undefined, color: '#ff6b5a', show: true };
  };
  renderer.targetColor = (e: Entity) => {
    const p = world.player!;
    if (e.realm === p.realm) return '#5fd068';
    return CON_HEX[conColor(p.level, e.level)];
  };

  let playing = false;
  const cycle: number[] = [];
  const nextTarget = () => {
    const p = world.player!;
    const cands: Entity[] = [];
    world.near(p.x, p.z, 45, (o) => { if (world.hostile(p, o) && o.kind !== 'door') cands.push(o); });
    if (!cands.length) {
      // a keep gate if that's all there is
      world.near(p.x, p.z, 25, (o) => { if (world.hostile(p, o)) cands.push(o); });
    }
    if (!cands.length) return;
    // prefer what's in front, then near
    const score = (o: Entity) => {
      const a = Math.abs(Math.atan2(Math.sin(Math.atan2(o.z - p.z, o.x - p.x) - p.facing), Math.cos(Math.atan2(o.z - p.z, o.x - p.x) - p.facing)));
      return dist(p, o) * (a < 1 ? 1 : 2.5);
    };
    cands.sort((a, b) => score(a) - score(b));
    const fresh = cands.find((c) => !cycle.includes(c.id)) ?? cands[0];
    if (!cands.some((c) => !cycle.includes(c.id))) cycle.length = 0;
    cycle.push(fresh.id);
    if (cycle.length > 8) cycle.shift();
    p.target = fresh.id;
  };

  const useSlot = (i: number) => {
    const p = world.player, ch = world.char;
    if (!p || !ch) return;
    if (i === 10) return world.drink('health');
    if (i === 11) return world.drink('power');
    const id = ch.hotbar[i];
    if (!id) return;
    const ab = ABILITIES[id];
    if ((ab.target === 'enemy' || ab.target === 'enemyAoe') && !(world.get(p.target) && world.hostile(p, world.get(p.target)!))) nextTarget();
    if (world.useAbility(p, id)) sfx.error();
  };
  hud.onSlot = useSlot;

  const interact = () => {
    const it = world.interactable();
    if (it) panels.talk(it);
  };

  const controls = new Controls(canvas, world, {
    onClick: (x, y, button) => {
      if (!playing) return;
      const p = world.player!;
      const id = renderer.pick(x, y);
      if (id == null) return;
      const e = world.get(id)!;
      p.target = id;
      if (button === 2) {
        if (e.kind === 'npc' && e.realm === p.realm && dist(p, e) < 8) panels.talk(e);
        else if (world.hostile(p, e) && !p.attacking) world.toggleAttack();
      }
    },
    onKey: (code, ev) => {
      if (!playing) return false;
      const p = world.player!;
      if (/^Digit\d$/.test(code)) {
        const n = +code.slice(5);
        useSlot(n === 0 ? 9 : n - 1);
        return true;
      }
      switch (code) {
        case 'KeyG': useSlot(10); return true;
        case 'KeyV': useSlot(11); return true;
        case 'Tab': nextTarget(); return true;
        case 'Escape':
          if (panels.closeTop()) return true;
          if (p.target != null) { p.target = null; p.attacking = false; return true; }
          panels.show('menu');
          return true;
        case 'KeyF': interact(); return true;
        case 'KeyC': panels.toggle('char'); return true;
        case 'KeyI': case 'KeyB': panels.toggle('bag'); return true;
        case 'KeyK': case 'KeyL': panels.toggle('abilities'); return true;
        case 'KeyM': panels.toggle('map'); return true;
        case 'F1': case 'KeyH': panels.toggle('help'); return true;
        case 'KeyZ': world.toggleAttack(); return true;
        case 'KeyR': controls.autorun = !controls.autorun; return true;
        case 'KeyT': if (ev.shiftKey) { p.target = p.id; return true; } return false;
      }
      return false;
    },
  });
  hud.onButton = (b) => {
    if (b === 'char' || b === 'bag' || b === 'abilities' || b === 'map' || b === 'help' || b === 'menu') panels.toggle(b);
  };

  const start = (c: CharSave) => {
    title.hide();
    world.spawnPlayer(c);
    world.logs.length = 0;
    hud.root.style.display = 'block';
    controls.snapBehind();
    controls.enabled = true;
    playing = true;
    const town = REALM_DEFS[c.realm];
    hud.say(`Welcome to ${town.name}, ${c.name}. Press F1 for help.`, 'system');
    hud.banner(world.geo.zoneAt(c.x, c.z).name);
    saveChar(c);
  };
  const quit = () => {
    if (!world.char) return;
    saveChar(world.dump());
    const p = world.player!;
    world.remove(p);
    world.player = null;
    world.char = null;
    playing = false;
    hud.root.style.display = 'none';
    for (const id of [...panels.open]) panels.close(id);
    title.show();
  };
  panels.onQuit = quit;
  title.onPlay = start;

  setInterval(() => { if (world.char) saveChar(world.dump()); }, 10000);
  window.addEventListener('beforeunload', () => { if (world.char) saveChar(world.dump()); });

  const resize = () => renderer.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  resize();

  // title camera slowly circles Highcrown
  let orbit = 0;
  const focus = { x: 0, y: 0, z: 0 };
  let last = performance.now();
  let zoneName = '';
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    controls.update(dt);
    world.step(dt);
    const events = world.events.splice(0);
    renderer.handle(events);
    const p = world.player;
    if (playing && p) {
      hud.handle(events);
      focus.x += (p.x - focus.x) * Math.min(1, dt * 30);
      focus.z += (p.z - focus.z) * Math.min(1, dt * 30);
      focus.y = p.y + 1.7;
      if (Math.abs(focus.x - p.x) > 20 || Math.abs(focus.z - p.z) > 20) { focus.x = p.x; focus.z = p.z; }
      controls.place(renderer.camera, focus.x, focus.y, focus.z);
      renderer.focus.set(p.x, p.y, p.z);
      renderer.hidePlayer = controls.distance < 3;
      const z = world.geo.zoneAt(p.x, p.z).name;
      if (z !== zoneName) {
        if (zoneName) hud.banner(z);
        zoneName = z;
        hud.say(`You have entered ${z}.`, 'system');
      }
    } else {
      orbit += dt * 0.04;
      const k = KEEPS[6];
      const cx = k.x + Math.cos(orbit) * 95, cz = k.z + Math.sin(orbit) * 95;
      renderer.camera.position.set(cx, world.geo.height(cx, cz) + 38, cz);
      renderer.camera.lookAt(k.x, world.geo.height(k.x, k.z) + 6, k.z);
      renderer.focus.set(k.x, 0, k.z);
      world.logs.length = 0;
    }
    renderer.render(dt);
    if (settings.fps) {
      const ms = now - (frame as unknown as { prev?: number }).prev!;
      (frame as unknown as { prev?: number }).prev = now;
      if (ms > 0 && ms < 1000) {
        fpsStats.frames++;
        fpsStats.time += ms;
        fpsStats.worst = Math.max(fpsStats.worst, ms);
      }
      if (fpsStats.time >= 500) {
        const info = renderer.renderer.info.render;
        const fps = (fpsStats.frames * 1000) / fpsStats.time;
        fpsEl.textContent = `${fps.toFixed(0)} fps · ${(fpsStats.time / fpsStats.frames).toFixed(1)} ms (worst ${fpsStats.worst.toFixed(0)}) · ${info.calls} draws · ${(info.triangles / 1000).toFixed(0)}k tris`;
        fpsEl.style.color = fps >= 50 ? '#7dff9a' : fps >= 30 ? '#ffd84a' : '#ff7b6b';
        fpsStats.frames = fpsStats.time = fpsStats.worst = 0;
      }
    }
    if (playing) {
      hud.update(dt);
      panels.update(dt);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  loading.style.display = 'none';

  const game = { world, renderer, controls, hud, panels, start, quit, useSlot };
  (window as unknown as { game: typeof game }).game = game;

  if (params.has('autostart')) {
    const cls = (params.get('class') ?? 'warden') as ClassId;
    const realm = +(params.get('realm') ?? 0) as RealmId;
    const c = World.newChar('Tester', realm, cls, seed);
    const lvl = Math.min(MAX_LEVEL, +(params.get('level') ?? 1));
    if (lvl > 1) {
      c.level = lvl;
      const r = new Rng(5);
      for (const s of SLOTS) c.equip[s] = makeItem(r, cls, lvl, { slot: s, rarity: 1 });
      CLASSES[cls].abilities.filter((a) => ABILITIES[a].level <= lvl).forEach((a, i) => { if (i < 10) c.hotbar[i] = a; });
    }
    start(c);
    if (params.get('at') === 'frontier') {
      const opt = world.travelOptions().find((o) => o.label.includes('Frontier'));
      if (opt) { world.player!.x = opt.x; world.player!.z = opt.z; }
    }
  } else title.show();
}

requestAnimationFrame(() => setTimeout(boot, 30));
