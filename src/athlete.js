import { mountShell } from './shell.js';
import { TODAY, athleteBy, athletes, challenges, workoutsOf } from './data.js';
import { replay } from './rules.js';
import { dayDate, int, km, nameOf, ordinal, plural, shortAddr } from './format.js';
import { WORKOUT_HEAD, avatar, chain, esc, workoutRow } from './ui.js';
import { account } from './chain.js';

const asked = new URLSearchParams(location.search).get('a');
const a = athleteBy(asked) || athleteBy(account()) || (!asked && athletes[1]);
const { me } = mountShell({ page: 'athlete', crumb: `Athletes / <b>${a ? esc(nameOf(a)) : 'Not found'}</b>` });
const root = document.querySelector('[data-root]');

if (!a) {
  root.innerHTML = `<div class="title-row"><div><h1>No record for this address</h1><p class="sub">${esc(asked)} has not logged a workout on Runar.</p></div></div>
    <p>Use the search above to find an athlete by name or address.</p>`;
} else {
  document.title = `${nameOf(a)} · Runar`;
  const list = workoutsOf(a.address);
  const p = a.profile;
  const mine = a.address === me;
  const joined = challenges.filter((c) => c.standings.some((r) => r.address === a.address));
  const first = list[0];

  root.innerHTML = `
    <div class="title-row">
      <div class="ath-title">${avatar(a)}
        <div><h1>${esc(nameOf(a))}${mine ? '<span class="you">you</span>' : ''}${a.team ? ' <span class="pill">Team</span>' : ''}</h1>
        <p class="sub"><span class="num">${shortAddr(a.address)}</span> <button class="textbtn" type="button" data-copy>Copy address</button> · ${plural(p.totalWorkouts, 'workout')} since ${first ? dayDate(first.dayId) : '—'}, all public on BOT Chain</p></div>
      </div>
      ${mine ? '<div class="title-actions"><a class="btn primary" href="/app/log.html">Log a workout</a></div>' : ''}
    </div>

    <div class="kpis" aria-label="getProfile">
      <div class="kpi"><div class="kpi-label">Workouts</div><div class="kpi-value">${int(p.totalWorkouts)}</div></div>
      <div class="kpi"><div class="kpi-label">Current streak</div><div class="kpi-value">${a.currentStreak}<small>${a.currentStreak === 1 ? 'day' : 'days'}</small></div>${a.currentStreak !== p.streak ? `<div class="kpi-note">stored ${p.streak}, broken since ${dayDate(p.lastWorkoutDay)}</div>` : ''}</div>
      <div class="kpi"><div class="kpi-label">Best streak</div><div class="kpi-value">${p.bestStreak}<small>days</small></div></div>
      <div class="kpi"><div class="kpi-label">Points</div><div class="kpi-value">${int(p.points)}</div></div>
      <div class="kpi"><div class="kpi-label">Last workout</div><div class="kpi-value">${p.lastWorkoutDay != null ? dayDate(p.lastWorkoutDay) : '—'}</div><div class="kpi-note">day ${p.lastWorkoutDay ?? '—'}</div></div>
    </div>

    <div class="split" style="margin-top: var(--gap)">
      <div class="stack">
        <section class="panel"><header><h2>Last 28 days</h2><span class="meta">${plural(new Set(list.filter((w) => w.dayId > TODAY - 28).map((w) => w.dayId)).size, 'day')} with a workout</span></header>${chain(a.address, 28)}</section>
        <section class="panel">
          <header><h2>Workouts</h2><span class="meta">All ${int(list.length)}, newest first</span></header>
          <div class="table-wrap"><table class="workouts">${WORKOUT_HEAD}<tbody>${[...list].reverse().map((w) => workoutRow(w)).join('')}</tbody></table></div>
        </section>
      </div>
      <aside class="stack">
        <section>
          <h2 class="rail-head">Check this record</h2>
          <div class="panel replay" data-replay>
            <p>Rebuild this profile from its ${plural(list.length, 'WorkoutLogged event')} in your browser, using the contract’s rules, and compare.</p>
            <button class="btn primary block" type="button" data-run>Replay from events</button>
          </div>
        </section>
        <section>
          <h2 class="rail-head">Challenges</h2>
          <div class="panel">${joined.length ? `<ul class="mych">${joined.map((c) => { const r = c.standings.find((x) => x.address === a.address); return `<li><a href="/app/challenge.html?id=${c.id}"><b>${esc(c.name)}</b><span class="muted">${c.status === 'closed' ? (c.winner && c.winner.address === a.address ? 'Won' : 'Closed') : c.status === 'ended' ? 'Ended' : c.status === 'upcoming' ? 'Starts ' + dayDate(c.startDay) : 'Open'}</span></a><span class="num">${c.status === 'upcoming' ? '—' : `${ordinal(r.rank)} <small class="muted">of ${c.participants}</small>`}</span></li>`; }).join('')}</ul>` : '<p class="empty">Hasn’t joined a challenge.</p>'}</div>
        </section>
      </aside>
    </div>`;

  root.querySelector('[data-copy]').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(a.address); e.target.textContent = 'Copied'; } catch { e.target.textContent = a.address; }
  });

  // the skeptic's check: replay the events, compare with getProfile
  root.querySelector('[data-run]').addEventListener('click', () => {
    const r = replay(list);
    const checks = [
      ['Workouts', p.totalWorkouts, r.totalWorkouts],
      ['Streak (stored)', p.streak, r.streak],
      ['Best streak', p.bestStreak, r.bestStreak],
      ['Points', p.points, r.points],
      ['Last workout day', p.lastWorkoutDay, r.lastWorkoutDay],
    ];
    const ok = checks.every(([, x, y]) => x === y);
    root.querySelector('[data-replay]').innerHTML = `
      <p class="replay-verdict ${ok ? 'ok' : 'bad'}">${ok ? `All ${checks.length} figures match` : 'Mismatch found'}</p>
      <table class="replay-table"><thead><tr><th></th><th class="n">Contract</th><th class="n">Replayed</th></tr></thead><tbody>
        ${checks.map(([k, x, y]) => `<tr><td>${k}</td><td class="n num">${k.startsWith('Last') ? x : int(x)}</td><td class="n num">${k.startsWith('Last') ? y : int(y)}${x === y ? '' : ' <span class="pill neg">differs</span>'}</td></tr>`).join('')}
      </tbody></table>
      <p class="muted">Replayed ${plural(list.length, 'event')} with the streak and points rules of Runar.sol. ${km(list.reduce((s, w) => s + w.distanceM, 0), 1)} km logged in total.</p>`;
  });
}
