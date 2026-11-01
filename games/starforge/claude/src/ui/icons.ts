const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  attack: svg('<path d="M4 20 15 9"/><path d="M14 4h6v6"/><path d="M20 4 9 15"/><path d="M5 15l4 4"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
  hold: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  build: svg('<path d="M14 6l4 4"/><path d="M3 21l9-9"/><path d="M12 3l9 9-3 3-9-9z"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  rally: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  cancel: svg('<path d="M6 6l12 12"/><path d="M18 6 6 18"/>'),
  ok: svg('<path d="M5 12l5 5 9-10"/>'),
  ret: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  army: svg('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2-6 5-6s5 3 5 6"/><path d="M11 20c0-3 2-6 5-6s5 3 5 6"/>'),
  worker: svg('<path d="M14 4l6 6"/><path d="M4 20 15 9"/><path d="M12 3c2-1 6 1 9 4"/>'),
  box: svg('<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 3"/>'),
  home: svg('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>'),
  menu: svg('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
