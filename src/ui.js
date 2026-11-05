// Small rendering pieces shared by the app screens.
import { TODAY, athletes, workoutsOf } from './data.js';
import { ACTIVITIES } from './rules.js';
import { nameOf, shortHash, relDay, dayDate, duration, km, int } from './format.js';
import { txHref } from './config.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Each athlete keeps one pale tint of their own hue: identity, never data.
const HUES = [28, 208, 148, 328, 88, 258, 178, 358, 118, 228, 58, 288];
export function avatar(a, size = '') {
  const i = athletes.findIndex((x) => x.address === a.address);
  const label = (a.name || a.address.slice(2)).replace(/[^a-z0-9]/gi, '').slice(0, 1).toUpperCase();
  return `<span class="avatar${size ? ' ' + size : ''}" style="--av: hsl(${HUES[i % HUES.length]} 70% 90%)" aria-hidden="true">${label}</span>`;
}

export const FLAME = (on = true) => `<svg class="flame${on ? '' : ' off'}" viewBox="0 0 22 28" aria-hidden="true"><path d="M11 1c1 5 7 8 7 15a7 7 0 0 1-14 0c0-3.5 2-5.5 3.5-7 .3 2.2 1.2 3.4 2.5 4C10 9.5 9.5 5 11 1Z"/></svg>`;

// The day chain: one cell per UTC day, linked while the streak holds, today marked.
export function chain(address, days = 28) {
  const set = new Set(workoutsOf(address).map((w) => w.dayId));
  const cells = [];
  for (let d = TODAY - days + 1; d <= TODAY; d++) {
    const on = set.has(d);
    const link = on && set.has(d + 1) && d < TODAY;
    const label = `${relDay(d, TODAY)}${d === TODAY || d === TODAY - 1 ? '' : ''}: ${on ? 'workout logged' : 'no workout'}`;
    cells.push(`<li class="${on ? 'on' : ''}${link ? ' link' : ''}${d === TODAY ? ' today' : ''}" title="${dayDate(d)}: ${on ? 'workout logged' : 'no workout'}" aria-label="${label}"></li>`);
  }
  return `<ol class="chain" style="--n:${days}" aria-label="Workouts over the last ${days} days">${cells.join('')}</ol>
    <div class="chain-axis"><span>${dayDate(TODAY - days + 1)}</span><span>Today, ${dayDate(TODAY)}</span></div>`;
}

export const activityLabel = (id) => ACTIVITIES[id].label;
export const distanceCell = (w) => (w.distanceM ? `${km(w.distanceM)} <small class="muted">km</small>` : '<span class="muted" aria-label="no distance">—</span>');

export function workoutRow(w, { showWho = false, who = null } = {}) {
  return `<tr id="w${w.workoutId}">
    <td>${showWho && who ? `<span class="who">${avatar(who, 'sm')}<a href="/app/athlete.html?a=${who.address}"><b>${esc(nameOf(who))}</b></a></span>` : `<b>${activityLabel(w.activity)}</b>${w.note ? `<span class="sub">${esc(w.note)}</span>` : ''}`}</td>
    <td class="n num">${relDay(w.dayId, TODAY)}<span class="sub">day ${w.dayId}</span></td>
    <td class="n num">${duration(w.durationSec)}</td>
    <td class="n num">${distanceCell(w)}</td>
    <td class="n num">+${int(w.points)}<span class="sub">streak ${w.streakAfter}</span></td>
    <td class="n"><a class="tx num" href="${txHref(w.tx)}" target="_blank" rel="noopener">${shortHash(w.tx)}</a><span class="sub">#${w.workoutId}</span></td>
  </tr>`;
}
export const WORKOUT_HEAD = `<thead><tr><th>Workout</th><th class="n">Day</th><th class="n">Duration</th><th class="n">Distance</th><th class="n">Points</th><th class="n">Transaction</th></tr></thead>`;

// A phase label for a transaction in flight.
export const PHASE = { signing: 'Waiting for your signature…', confirming: 'Confirming on BOT Chain…' };
