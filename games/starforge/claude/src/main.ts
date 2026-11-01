import './style.css';
import type { Difficulty } from './game/ai';
import { Game } from './ui/game';

const app = document.getElementById('app')!;
let game: Game | null = null;
let difficulty: Difficulty = (localStorage.getItem('sf-difficulty') as Difficulty) || 'normal';

function menu() {
  game?.destroy();
  game = null;
  app.innerHTML = `
    <div class="menu">
      <div class="stars"></div>
      <div class="menu-inner">
        <h1>STAR<span>FORGE</span></h1>
        <p class="tag">Real-time strategy on the frontier</p>
        <div class="diff">
          ${(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => `<button class="chip ${d === difficulty ? 'on' : ''}" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
        </div>
        <button class="primary big" data-start>Start Battle</button>
        <details class="howto">
          <summary>How to play</summary>
          <ul>
            <li><b>Harvesters</b> gather <b class="c">crystal</b> and, from an Extractor on a vent, <b class="f">flux</b>.</li>
            <li>Build <b>Habitats</b> for supply, a <b>Garrison</b> for infantry, then <b>War Works</b> and a <b>Skyport</b>.</li>
            <li><b>Tap</b> a unit to select it, then tap the ground to move or an enemy to attack.</li>
            <li><b>Long-press &amp; drag</b> (or the Select button) to box-select. <b>Double-tap</b> selects all of a type.</li>
            <li><b>Drag</b> to pan, <b>pinch</b> to zoom, tap the minimap to jump.</li>
            <li>Destroy every enemy building to win.</li>
          </ul>
        </details>
      </div>
    </div>`;
  app.querySelectorAll<HTMLElement>('[data-d]').forEach((b) =>
    b.addEventListener('click', () => {
      difficulty = b.dataset.d as Difficulty;
      try {
        localStorage.setItem('sf-difficulty', difficulty);
      } catch {
        // storage may be unavailable (private mode); the choice still applies this session
      }
      menu();
    }),
  );
  app.querySelector('[data-start]')!.addEventListener('click', () => start());
}

function start() {
  game?.destroy();
  app.innerHTML = '';
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed')) || Math.floor(Math.random() * 1e9);
  game = new Game(app, { difficulty, seed }, { onExit: menu, onRestart: start });
  game.audio.unlock();
  game.start();
  (window as unknown as { game: Game }).game = game;
}

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && !game.over) game.togglePause(true);
});

if (new URLSearchParams(location.search).has('autostart')) start();
else menu();
