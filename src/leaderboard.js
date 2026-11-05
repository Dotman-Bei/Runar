import { mountShell } from './shell.js';
import { ranked } from './data.js';
import { dayDate, int, km, nameOf, plural, shortAddr } from './format.js';
import { avatar, esc } from './ui.js';

const { me } = mountShell({ page: 'leaderboard', crumb: 'Runar / <b>Leaderboard</b>' });
const $ = (s) => document.querySelector(s);

const TABS = {
  points: {
    head: ['Points', 'Workouts'], value: (a) => a.profile.points, second: (a) => int(a.profile.totalWorkouts),
    fmt: (a) => int(a.profile.points), unit: 'points',
    explain: 'All-time points. Each workout earns its activity weight for every 10 minutes, multiplied by the streak it was logged on, up to ×2.0 from day 11.',
  },
  streak: {
    head: ['Current streak', 'Best streak'], value: (a) => a.currentStreak, second: (a) => plural(a.profile.bestStreak, 'day'),
    fmt: (a) => plural(a.currentStreak, 'day'), unit: 'days',
    explain: 'Consecutive UTC days with at least one workout, counting today or yesterday. A streak whose last workout was two or more days ago shows as 0.',
  },
  week: {
    head: ['Minutes', 'Distance'], value: (a) => a.weekMinutes, second: (a) => `${km(a.weekKm * 1000, 1)} km`,
    fmt: (a) => `${int(a.weekMinutes)} min`, unit: 'min',
    explain: 'Minutes logged over the last 7 UTC days, today included. Distance is shown beside it; gym sessions add time but no distance.',
  },
};

const params = new URLSearchParams(location.search);
let tab = TABS[params.get('tab')] ? params.get('tab') : 'points';

function render() {
  const t = TABS[tab];
  // ties keep a stable order: lower address first
  const rows = ranked().sort((a, b) => t.value(b) - t.value(a) || a.address.localeCompare(b.address));
  $('[data-table]').innerHTML = `<thead><tr><th class="rank">Rank</th><th>Athlete</th><th class="n">${t.head[0]}</th><th class="n col-2">${t.head[1]}</th><th class="n col-3">Last workout</th></tr></thead>
    <tbody>${rows.length ? '' : '<tr><td colspan="5"><p class="empty">No workouts are on the chain yet. <a class="tx" href="/app/log.html">Log the first one</a>.</p></td></tr>'}${rows.map((a, i) => `<tr class="${a.address === me ? 'me' : ''}">
      <td class="rank num">${i + 1}</td>
      <td><span class="who">${avatar(a)}<a href="/app/athlete.html?a=${a.address}"><span><b>${esc(nameOf(a))}</b>${a.address === me ? '<span class="you">you</span>' : ''}</span><span class="sub num">${shortAddr(a.address)}</span></a>${a.team ? '<span class="pill">Team</span>' : ''}</span></td>
      <td class="n num fig-main">${t.fmt(a)}</td>
      <td class="n num col-2">${t.second(a)}</td>
      <td class="n num col-3">${a.profile.lastWorkoutDay != null ? dayDate(a.profile.lastWorkoutDay) : '—'}</td>
    </tr>`).join('')}</tbody>`;
  $('[data-explain]').textContent = t.explain;
  document.querySelector('[data-team]').hidden = !rows.some((a) => a.team);

  // the finding: where you stand and the gap to the next place
  const i = rows.findIndex((a) => a.address === me);
  if (i >= 0) {
    const gap = i > 0 ? t.value(rows[i - 1]) - t.value(rows[i]) : 0;
    $('[data-sub]').innerHTML = i === 0 ? `You’re <b>1st</b> on ${t.head[0].toLowerCase()}.`
      : `You’re <b>${i + 1} of ${rows.length}</b> on ${t.head[0].toLowerCase()}, ${int(gap)} ${t.unit} behind ${esc(nameOf(rows[i - 1]))}.`;
  }
  document.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
}

const tabs = [...document.querySelectorAll('[data-tab]')];
tabs.forEach((b, i) => {
  b.addEventListener('click', () => { tab = b.dataset.tab; history.replaceState(null, '', `?tab=${tab}`); render(); });
  b.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length]; n.click(); n.focus();
  });
});
render();
