import test from 'node:test';
import assert from 'node:assert/strict';

test('the static UI starts a game, renders a frame, and opens inventory', async () => {
  const elements = new Map(), frames = [];
  const context = new Proxy({}, { get(target, key) {
    if (key === 'createRadialGradient') return () => ({ addColorStop() {} });
    if (key === 'measureText') return () => ({ width: 10 });
    if (!(key in target)) target[key] = () => {};
    return target[key];
  }, set(target, key, value) { target[key] = value; return true; } });
  function element(id = '') {
    const listeners = new Map(), classes = new Set(id === 'start-screen' ? [] : ['hidden']);
    const node = {
      id, dataset: {}, style: {}, textContent: '', children: [],
      className: '', firstChild: { textContent: '' }, firstElementChild: { textContent: '' },
      classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c), toggle(c, on) { if (on) classes.add(c); else classes.delete(c); } },
      addEventListener: (type, fn) => listeners.set(type, fn),
      dispatch: (type, event = {}) => listeners.get(type)?.(event),
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      getContext: () => context,
      querySelector: () => get('joystick-knob'),
      setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 112, height: 112 })
    };
    return node;
  }
  function get(id) { if (!elements.has(id)) elements.set(id, element(id)); return elements.get(id); }
  const cards = ['knight','ranger','mage'].map(id => { const card = element(); card.dataset.class = id; return card; });
  globalThis.document = { getElementById: get, createElement: () => element(), querySelectorAll: () => cards };
  globalThis.window = { innerWidth: 1024, innerHeight: 768, devicePixelRatio: 1, addEventListener() {} };
  globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  globalThis.requestAnimationFrame = fn => frames.push(fn);
  await import('./main.js');
  assert.equal(frames.length, 1);
  get('start-button').dispatch('click');
  assert.equal(get('hud').classList.contains('hidden'), false);
  assert.match(get('hero-name').textContent, /WARDEN/);
  frames.shift()(performance.now() + 16);
  assert.equal(frames.length, 1, 'render loop continues');
  get('inventory-button').dispatch('click');
  assert.equal(get('inventory-panel').classList.contains('hidden'), false);
  assert.equal(get('equipment-grid').children.length, 3);
});
