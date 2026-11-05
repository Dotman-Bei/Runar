import { mountShell, notify } from './shell.js';
import { TODAY, athleteBy, challenges, ranked, workoutsOf } from './data.js';
import { replay } from './rules.js';
import { dayDate, int, km, nameOf, ordinal, plural, shortAddr } from './format.js';
import { WORKOUT_HEAD, avatar, chain, esc, workoutRow } from './ui.js';
import { account, disconnect, setDisplayName } from './chain.js';
import { addressHref } from './config.js';
import { readProfile } from './rpc.js';

const asked = new URLSearchParams(location.search).get('a');
// without an address: your own record, or the current points leader for a visitor
const top = () => ranked().sort((x, y) => y.profile.points - x.profile.points)[0];
const a = asked ? athleteBy(asked) : (account() ? athleteBy(account()) : top());
const { me } = mountShell({ page: 'athlete', crumb: `Athletes / <b>${a ? esc(nameOf(a)) : 'Not found'}</b>` });
const root = document.querySelector('[data-root]');

if (!a) {
  root.innerHTML = asked
    ? `<div class="title-row"><div><h1>No record for this address</h1><p class="sub">${esc(asked)} has not logged a workout on Runar.</p></div></div>
    <p>Use the search above to find an athlete by name or address.</p>`
    : `<div class="title-row"><div><h1>No records yet</h1><p class="sub">Nobody has logged a workout on Runar yet.</p></div></div>
    <a class="btn primary" href="/app/log.html">Log the first workout</a>`;
} else {
  document.title = `${nameOf(a)} · Runar`;
  const list = workoutsOf(a.address);
  const p = a.profile;
  const mine = !!me && a.address.toLowerCase() === me.toLowerCase();
  const joined = challenges.filter((c) => c.standings.some((r) => r.address === a.address));
  const first = list[0];

  root.innerHTML = `
    <div class="title-row">
      <div class="ath-title">${avatar(a)}
        <div><h1>${esc(nameOf(a))}${mine ? '<span class="you">you</span>' : ''}${a.team ? ' <span class="pill">Team</span>' : ''}</h1>
        <p class="sub"><span class="num">${shortAddr(a.address)}</span> <button class="textbtn" type="button" data-copy>Copy address</button> · <a class="tx" href="${addressHref(a.address)}" target="_blank" rel="noopener">BOTScan</a> · ${first ? `${plural(p.totalWorkouts, 'workout')} since ${dayDate(first.dayId)}, all public` : 'no workouts yet'}${mine ? ' · <button class="textbtn" type="button" data-disconnect>Disconnect</button>' : ''}</p></div>
      </div>
      ${mine ? '<div class="title-actions"><a class="btn primary" href="/app/log.html">Log a workout</a></div>' : ''}
    </div>

    <div class="kpis" aria-label="getProfile">
      <div class="kpi"><div class="kpi-label">Workouts</div><div class="kpi-value">${int(p.totalWorkouts)}</div></div>
      <div class="kpi"><div class="kpi-label">Current streak</div><div class="kpi-value">${a.currentStreak}<small>${a.currentStreak === 1 ? 'day' : 'days'}</small></div>${a.currentStreak !== p.streak ? `<div class="kpi-note">stored ${p.streak}, broken since ${dayDate(p.lastWorkoutDay)}</div>` : ''}</div>
      <div class="kpi"><div class="kpi-label">Best streak</div><div class="kpi-value">${p.bestStreak}<small>${p.bestStreak === 1 ? 'day' : 'days'}</small></div></div>
      <div class="kpi"><div class="kpi-label">Points</div><div class="kpi-value">${int(p.points)}</div></div>
      <div class="kpi"><div class="kpi-label">Last workout</div><div class="kpi-value">${p.lastWorkoutDay != null ? dayDate(p.lastWorkoutDay) : '—'}</div>${p.lastWorkoutDay != null ? `<div class="kpi-note">day ${p.lastWorkoutDay}</div>` : ''}</div>
    </div>

    <div class="split" style="margin-top: var(--gap)">
      <div class="stack">
        <section class="panel"><header><h2>Last 28 days</h2><span class="meta">${plural(new Set(list.filter((w) => w.dayId > TODAY - 28).map((w) => w.dayId)).size, 'day')} with a workout</span></header>${chain(a.address, 28)}</section>
        <section class="panel">
          <header><h2>Workouts</h2><span class="meta">All ${int(list.length)}, newest first</span></header>
          <div class="table-wrap"><table class="workouts">${WORKOUT_HEAD}<tbody>${list.length ? '' : '<tr><td colspan="6"><p class="empty">No workouts logged yet.</p></td></tr>'}${[...list].reverse().map((w) => workoutRow(w)).join('')}</tbody></table></div>
        </section>
      </div>
      <aside class="stack">
        ${mine ? `<section>
          <h2 class="rail-head">Display name</h2>
          <form class="panel name-form" data-name novalidate>
            <label class="sr-only" for="dn">Display name</label>
            <input class="input" id="dn" name="dn" maxlength="20" value="${esc(a.name || '')}" placeholder="your.name" autocomplete="off" aria-describedby="dn-hint">
            <p class="hint" id="dn-hint">3–20 characters: a–z, 0–9, dots and underscores. Public and unique. Leave empty to clear it. One transaction.</p>
            <p class="error-line" data-name-error hidden></p>
            <button class="btn block" type="submit" data-name-save>Save name</button>
          </form>
        </section>` : ''}
        <section>
          <h2 class="rail-head">Check this record</h2>
          <div class="panel replay" data-replay>
            <p>Rebuild this profile from its ${plural(list.length, 'WorkoutLogged event')} in your browser, using the contract’s rules, and compare it with what the contract reports right now.</p>
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
  root.querySelector('[data-disconnect]')?.addEventListener('click', () => { disconnect(); location.reload(); });

  root.querySelector('[data-name]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = root.querySelector('[data-name-error]');
    const btn = root.querySelector('[data-name-save]');
    const name = e.target.dn.value.trim();
    err.hidden = true;
    if (name && !/^[a-z0-9._]{3,20}$/.test(name)) {
      err.hidden = false;
      err.textContent = 'Use 3–20 characters: a–z, 0–9, dots and underscores.';
      return;
    }
    btn.disabled = true;
    try {
      await setDisplayName(name, (phase) => { btn.textContent = phase === 'signing' ? 'Sign in wallet…' : 'Confirming…'; });
      location.reload();
    } catch (ex) {
      btn.disabled = false;
      btn.textContent = 'Save name';
      err.hidden = false;
      err.textContent = ex.message;
    }
  });

  root.querySelector('[data-run]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Reading the contract…';
    let c;
    try {
      c = await readProfile(a.address);
    } catch {
      btn.disabled = false;
      btn.textContent = 'Replay from events';
      notify('Couldn’t read the contract. Check your connection and try again.');
      return;
    }
    const r = replay(list);
    const checks = [
      ['Workouts', c.totalWorkouts, r.totalWorkouts],
      ['Streak (stored)', c.streak, r.streak],
      ['Best streak', c.bestStreak, r.bestStreak],
      ['Points', c.points, r.points],
      ['Last workout day', c.lastWorkoutDay, r.lastWorkoutDay ?? 0],
    ];
    const ok = checks.every(([, x, y]) => x === y);
    root.querySelector('[data-replay]').innerHTML = `
      <p class="replay-verdict ${ok ? 'ok' : 'bad'}">${ok ? `All ${checks.length} figures match` : 'Mismatch found'}</p>
      <table class="replay-table"><thead><tr><th></th><th class="n">Contract</th><th class="n">Replayed</th></tr></thead><tbody>
        ${checks.map(([k, x, y]) => `<tr><td>${k}</td><td class="n num">${k.startsWith('Last') ? x : int(x)}</td><td class="n num">${k.startsWith('Last') ? y : int(y)}${x === y ? '' : ' <span class="pill neg">differs</span>'}</td></tr>`).join('')}
      </tbody></table>
      <p class="muted">Replayed ${plural(list.length, 'event')} with the streak and points rules, against getProfile on BOT Chain. ${km(list.reduce((s, w) => s + w.distanceM, 0), 1)} km logged in total.</p>`;
  });
}
