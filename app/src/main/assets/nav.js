// nav.js — barra inferior compartida entre las tres secciones de la app.
// Uso: <script src="nav.js" data-active="dosis" data-base="./"></script>
'use strict';

(() => {
  const script = document.currentScript;
  const active = script.dataset.active;
  const base = script.dataset.base || './';
  const tabs = [
    { id: 'dosis', label: 'Dosis', icon: '💊', href: base + 'index.html' },
    { id: 'fichas', label: 'Fichas', icon: '📋', href: base + 'fichas/index.html' },
    { id: 'anestesia', label: 'Anestesia', icon: '🩺', href: base + 'anestesia.html' },
  ];

  const css = `
    .appnav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 45; display: flex;
      background: #ffffff; border-top: 1px solid #dde3e1; padding-bottom: env(safe-area-inset-bottom);
      box-shadow: 0 -2px 10px rgba(0,0,0,.06); font-family: system-ui, -apple-system, Roboto, sans-serif; }
    .appnav a { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px;
      padding: 7px 0 8px; text-decoration: none; color: #5f6b67; font-size: 11.5px; font-weight: 600; }
    .appnav a span { font-size: 21px; line-height: 1.1; filter: grayscale(.6); opacity: .75; }
    .appnav a.on { color: #0f6e5c; }
    .appnav a.on span { filter: none; opacity: 1; }
    body { padding-bottom: calc(64px + env(safe-area-inset-bottom)) !important; }
    @media (prefers-color-scheme: dark) {
      .appnav { background: #19211f; border-top-color: #2b3633; }
      .appnav a { color: #9aa8a4; }
      .appnav a.on { color: #3fc1a3; }
    }
    html.dark .appnav { background: #0f172a; border-top-color: #334155; }
    html.dark .appnav a { color: #94a3b8; }
    html.dark .appnav a.on { color: #34d399; }
    html.appnav-dark .appnav { background: #0c1220; border-top-color: #1a2540; }
    html.appnav-dark .appnav a { color: #8fa0c2; }
    html.appnav-dark .appnav a.on { color: #2dd4bf; }`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const nav = document.createElement('nav');
  nav.className = 'appnav';
  nav.innerHTML = tabs.map((t) =>
    `<a href="${t.href}" class="${t.id === active ? 'on' : ''}"><span>${t.icon}</span>${t.label}</a>`).join('');
  const mount = () => document.body.appendChild(nav);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
