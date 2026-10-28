// The app frame: sidebar + top bar on desktop, top bar + bottom bar on a phone. Every app page calls mountShell().
import { athletes, athleteBy } from './data.js';
import { account, connect } from './chain.js';
import { CHAIN_ID, CHAIN_NAME } from './config.js';
import { nameOf, shortAddr } from './format.js';
import { avatar, esc } from './ui.js';

const ICONS = {
  dashboard: '<svg viewBox="0 0 16 16"><path d="M2 8.5 8 3l6 5.5M4 7.5V13h8V7.5"/></svg>',
  log: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 5v6M5 8h6"/></svg>',
  leaderboard: '<svg viewBox="0 0 16 16"><path d="M2.5 13.5V9h3v4.5M6.5 13.5V4h3v9.5M10.5 13.5V7h3v6.5"/></svg>',
  challenges: '<svg viewBox="0 0 16 16"><path d="M3.5 14V2.5M3.5 3h8l-1.5 3 1.5 3h-8"/></svg>',
  record: '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="12" rx="1"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/></svg>',
  search: '<svg viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>',
};

// The mark: a bib with an R, drawn for this product.
export const MARK = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="10" fill="#1f2b4d"/><rect x="10" y="14" width="44" height="36" fill="#fff"/><circle cx="15" cy="19" r="2" fill="#1f2b4d"/><circle cx="49" cy="19" r="2" fill="#1f2b4d"/><path d="M24 42V22h9a6 6 0 0 1 0 12h-9m9 0 7 8" fill="none" stroke="#f7941d" stroke-width="5" stroke-linejoin="round"/></svg>';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', short: 'Home', href: '/app/' },
  { id: 'log', label: 'Log workout', short: 'Log', href: '/app/log.html' },
  { id: 'leaderboard', label: 'Leaderboard', short: 'Ranks', href: '/app/leaderboard.html' },
  { id: 'challenges', label: 'Challenges', short: 'Challenges', href: '/app/challenges.html' },
];

export function mountShell({ page, crumb }) {
  const me = account();
  const meA = me && athleteBy(me);
  const navItem = (n) => `<a class="nav-item" href="${n.href}"${n.id === page ? ' aria-current="page"' : ''}>${ICONS[n.id]}${n.label}</a>`;
  const app = document.querySelector('.app');
  const canvas = app.querySelector('.canvas');

  app.insertAdjacentHTML('afterbegin', `
    <aside class="sidebar" aria-label="Runar">
      <a class="brand" href="/">${MARK}Runar</a>
      <nav class="nav" aria-label="Main">${NAV.map(navItem).join('')}</nav>
      <p class="nav-label">Your record</p>
      <nav class="nav" aria-label="Record">
        <a class="nav-item" href="/app/athlete.html${me ? `?a=${me}` : ''}"${page === 'athlete' && (!me || new URLSearchParams(location.search).get('a') === me) ? ' aria-current="page"' : ''}>${ICONS.record}Public record</a>
      </nav>
      <div class="sidebar-foot">
        <span class="net">${CHAIN_NAME} · chain ${CHAIN_ID}</span>
        <a href="/">About Runar</a>
      </div>
    </aside>
    <header class="topbar">
      <a class="brand-sm" href="/app/" aria-label="Runar, dashboard">${MARK}</a>
      <p class="crumb">${crumb}</p>
      <div class="search" role="search">
        ${ICONS.search}
        <label class="sr-only" for="athlete-search">Find an athlete</label>
        <input id="athlete-search" type="search" placeholder="Find an athlete by name or address" autocomplete="off">
        <div class="search-results" hidden></div>
      </div>
      ${meA
        ? `<a class="wallet" href="/app/athlete.html?a=${meA.address}" aria-label="Your record: ${esc(nameOf(meA))}">${avatar(meA)}<span class="wallet-text">${esc(nameOf(meA))}<small>${shortAddr(meA.address)}</small></span></a>`
        : `<button class="wallet" type="button" data-connect><span class="avatar" aria-hidden="true">?</span><span class="wallet-text">Connect wallet<small>to log and join</small></span></button>`}
    </header>`);
  app.insertAdjacentHTML('beforeend', `<nav class="bottombar" aria-label="Main">${NAV.map((n) => `<a href="${n.href}"${n.id === page ? ' aria-current="page"' : ''}>${ICONS[n.id]}${n.short}</a>`).join('')}</nav>`);
  canvas.id = 'main';

  app.querySelectorAll('[data-connect]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true;
    b.querySelector('.wallet-text').firstChild.textContent = 'Connecting…';
    await connect();
    location.reload();
  }));

  // athlete search: the skeptic's way in
  const input = app.querySelector('#athlete-search');
  const box = app.querySelector('.search-results');
  const run = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { box.hidden = true; return; }
    const hits = athletes.filter((a) => (a.name || '').toLowerCase().includes(q) || a.address.toLowerCase().includes(q)).slice(0, 6);
    box.innerHTML = hits.length
      ? hits.map((a) => `<a href="/app/athlete.html?a=${a.address}"><span>${esc(nameOf(a))}</span><span class="muted num">${shortAddr(a.address)}</span></a>`).join('')
      : `<p class="empty-line">No athlete matches “${esc(input.value.trim())}”.</p>`;
    box.hidden = false;
  };
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; box.hidden = true; }
    if (e.key === 'Enter') { const first = box.querySelector('a'); if (first) location.href = first.href; }
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) box.hidden = true; });

  return { me, meA };
}

// PWA: cache what was browsed so records stay readable offline (PRD §5.2). Production only.
if ('serviceWorker' in navigator && import.meta.env?.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
