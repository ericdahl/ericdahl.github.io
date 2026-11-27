const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await b.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto('http://localhost:5181/?autostart');
  await page.waitForFunction(() => window.game && window.game.world.player);
  const r = await page.evaluate(() => {
    const c = game.controls, w = game.world, p = w.player;
    const out = {};
    const run = (code) => {
      c.keys.clear(); c.keys.add(code);
      const f0 = p.facing; c.update(0.5);
      const f = p.facing, mx = w.input.mx, mz = w.input.mz;
      // movement relative to facing: right = (-sin f, cos f)
      out[code] = { turn: +(f - f0).toFixed(2), right: +(mx * -Math.sin(f) + mz * Math.cos(f)).toFixed(2), fwd: +(mx * Math.cos(f) + mz * Math.sin(f)).toFixed(2), sprint: w.input.sprint };
    };
    for (const k of ['KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyW']) run(k);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }));
    run('KeyW'); out.afterX = out.KeyW;
    c.keys.clear();
    return out;
  });
  console.log(JSON.stringify(r, null, 0));
  await b.close();
})();
