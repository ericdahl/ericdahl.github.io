import './style.css';
import { getText, openMine, textToStory } from './custom';
import { assetBase, loadStory } from './data';
import { openLibrary } from './library';
import { voicesReady } from './player';
import { openReader } from './reader';
import { applyToDocument } from './settings';
import { h } from './ui';

applyToDocument();
const app = document.getElementById('app')!;
let cleanup: () => void = () => {};
let lastLibraryScroll = 0;

function goHome(): void {
  location.hash = '#/';
}

async function route(): Promise<void> {
  const libraryScroller = document.scrollingElement;
  if (app.querySelector('.library') && libraryScroller) lastLibraryScroll = libraryScroller.scrollTop;
  cleanup();
  cleanup = () => {};
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, id] = hash.split('/').map(decodeURIComponent);
  document.documentElement.classList.toggle('reading', page === 'read' || (page === 'mine' && !!id));
  try {
    if (page === 'read' && id) {
      const story = await loadStory(id);
      cleanup = openReader(app, { story, base: assetBase, back: goHome });
      document.title = `${story.title} · 听读`;
    } else if (page === 'mine' && id) {
      const saved = getText(id);
      if (!saved) {
        location.hash = '#/mine';
        return;
      }
      await voicesReady();
      const story = await textToStory(saved);
      cleanup = openReader(app, { story, base: assetBase, back: () => (location.hash = '#/mine') });
      document.title = '自己的文章 · 听读';
    } else if (page === 'mine') {
      cleanup = await openMine(app, () => (location.hash = '#/'));
      document.title = '自己的文章 · 听读';
    } else {
      cleanup = await openLibrary(app);
      document.title = '听读 Tīngdú';
      requestAnimationFrame(() => libraryScroller?.scrollTo(0, lastLibraryScroll));
    }
  } catch (err) {
    app.replaceChildren(
      h('div', { class: 'screen error-screen' }, h('p', {}, `Something went wrong: ${String(err)}`), h('a', { href: '#/', class: 'pill' }, 'Back to the library')),
    );
  }
}

window.addEventListener('hashchange', () => void route());
void route();
