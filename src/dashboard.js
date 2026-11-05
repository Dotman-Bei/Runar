import { connectWallet, mountShell } from './shell.js';
import { TODAY, challenges, ranked, weekByDay, workoutsOf } from './data.js';
import { dayDate, int, km, nameOf, ordinal, plural, weekday } from './format.js';
import { FLAME, WORKOUT_HEAD, avatar, chain, esc, workoutRow } from './ui.js';

const { me, meA } = mountShell({ page: 'dashboard', crumb: 'Runar / <b>Dashboard</b>' });
const $ = (s) => document.querySelector(s);
const body = $('[data-body]');

function untilMidnight() {
  const left = (TODAY + 1) * 86400 - Date.now() / 1000;
  return `${Math.floor(left / 3600)} h ${Math.floor((left % 3600) / 60)} min`;
}

// ---- rail: the week's leaderboard around you, and your challenges ----------------------------------
function weekBoard() {
  const rows = ranked().sort((a, b) => b.weekMinutes - a.weekMinutes || a.address.localeCompare(b.address));
  const i = me ? rows.findIndex((a) => a.address === me) : 0;
  const from = Math.max(0, Math.min(i - 2, rows.length - 5));
  return `<section>
    <h2 class="rail-head">This week</h2>
    <div class="panel">${rows.length ? '' : '<p class="empty">Nobody has logged yet. The first workout takes first place.</p>'}<ol class="board">${rows.slice(from, from + 5).map((a, k) => `
      <li class="${a.address === me ? 'me' : ''}"><span class="rank num">${from + k + 1}</span>
        <a class="who" href="/app/athlete.html?a=${a.address}">${avatar(a, 'sm')}<b>${esc(nameOf(a))}</b></a>
        <span class="num">${int(a.weekMinutes)} <small class="muted">min</small></span></li>`).join('')}</ol>
      <p class="rail-foot"><span class="muted">Minutes over the last 7 UTC days</span><a class="card-link" href="/app/leaderboard.html?tab=week">Leaderboard</a></p>
    </div></section>`;
}

function myChallenges() {
  const mine = challenges.filter((c) => c.joined && c.status !== 'upcoming').sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1));
  const rows = mine.map((c) => {
    const r = c.standings.find((x) => x.address === me);
    const stat = c.goalType === 'distance' ? `${km(r.distanceM, 1)} km` : plural(r.count, 'workout');
    const when = c.status === 'open' ? `${plural(c.endDay - TODAY + 1, 'day')} left` : c.status === 'ended' ? 'Ended, waiting to be closed' : 'Closed';
    return `<li><a href="/app/challenge.html?id=${c.id}"><b>${esc(c.name)}</b><span class="muted">${when}</span></a>
      <span class="num">${ordinal(r.rank)} <small class="muted">of ${c.participants}</small><span class="sub">${stat}</span></span></li>`;
  }).join('');
  return `<section>
    <h2 class="rail-head">Your challenges</h2>
    <div class="panel">${rows ? `<ul class="mych">${rows}</ul>` : '<p class="empty">You haven’t joined a challenge yet.</p>'}
      <p class="rail-foot"><span class="muted">${challenges.filter((c) => c.status === 'open' && !c.joined).length} open to join</span><a class="card-link" href="/app/challenges.html">Challenges</a></p>
    </div></section>`;
}

// ---- first run: no wallet yet, or a wallet with no workouts -----------------------------------------
if (!meA || !meA.profile.totalWorkouts) {
  const open = challenges.filter((c) => c.status === 'open');
  if (meA) {
    $('[data-title]').textContent = nameOf(meA);
    $('[data-sub]').textContent = 'Your wallet is connected. Your first workout creates your record.';
    $('[data-primary]').textContent = 'Log your first workout';
  } else {
    $('[data-title]').textContent = 'Dashboard';
    $('[data-sub]').textContent = 'Connect a wallet to see your streak and points. Your address is your athlete ID.';
    $('[data-primary]').textContent = 'Connect wallet';
    $('[data-primary]').addEventListener('click', (e) => { e.preventDefault(); connectWallet(e.currentTarget); });
  }
  body.innerHTML = `<div class="stack">
      <section class="panel first-run">
        <h2>No record yet</h2>
        <p>Your first workout starts a 1-day streak and earns points straight away. Everything you log is public and stays on BOT Chain. You’ll need a little BOT for gas, about 0.004 BOT for a first workout.</p>
        <a class="btn primary big" href="/app/log.html">Log your first workout</a>
        ${meA ? `<a class="card-link" href="/app/athlete.html?a=${me}">Set a display name</a>` : ''}
      </section>
      <section class="panel">
        <header><h2>Open to join</h2><a class="card-link" href="/app/challenges.html">All challenges</a></header>
        ${open.length ? '' : '<p class="empty">No challenge is open right now.</p>'}<ul class="mych">${open.map((c) => `<li><a href="/app/challenge.html?id=${c.id}"><b>${esc(c.name)}</b><span class="muted">${esc(c.rule)}</span></a><span class="num">${plural(c.endDay - TODAY + 1, 'day')} left<span class="sub">${plural(c.participants, 'athlete')}</span></span></li>`).join('')}</ul>
      </section>
    </div>
    <aside class="stack">${weekBoard()}</aside>`;
} else {
  const p = meA.profile;
  const mine = workoutsOf(me);
  $('[data-title]').textContent = nameOf(meA);
  $('[data-sub]').innerHTML = meA.loggedToday
    ? `Logged today. Your streak is safe until 00:00 UTC tomorrow.`
    : meA.currentStreak
      ? `You haven’t logged today. <b>${untilMidnight()}</b> left to make it ${meA.currentStreak + 1} days.`
      : `Your last streak ended on ${dayDate(p.lastWorkoutDay)}. Log today to start a new one.`;
  if (meA.loggedToday) $('[data-primary]').textContent = 'Log another workout';

  // last 7 UTC days, oldest first
  const week = [...Array(7)].map((_, i) => TODAY - 6 + i);
  const perDay = weekByDay(mine);
  const weekMin = perDay.reduce((a, b) => a + b, 0);
  console.assert(weekMin === meA.weekMinutes, 'week minutes disagree');

  body.innerHTML = `
    <div class="stack">
      <section class="panel streak-card" aria-labelledby="streak-h">
        <div class="streak-fig">
          ${FLAME(meA.currentStreak > 0)}
          <div><h2 id="streak-h" class="sr-only">Current streak</h2><p class="answer-fig num">${plural(meA.currentStreak, 'day')}</p><p class="muted">current streak</p></div>
          <dl class="streak-facts">
            <div><dt>Best streak</dt><dd class="num">${plural(p.bestStreak, 'day')}</dd></div>
            <div><dt>Last workout</dt><dd class="num">${dayDate(p.lastWorkoutDay)}<span class="muted"> · day ${p.lastWorkoutDay}</span></dd></div>
            <div><dt>Multiplier ${meA.loggedToday ? 'now' : 'if you log today'}</dt><dd class="num">×${(Math.min(10 + (meA.loggedToday ? meA.currentStreak : meA.currentStreak + 1) - 1, 20) / 10).toFixed(1)}</dd></div>
          </dl>
        </div>
        ${chain(me, 28)}
      </section>

      <div class="kpis">
        <div class="kpi"><div class="kpi-label">Points</div><div class="kpi-value">${int(p.points)}</div><div class="kpi-note">all time</div></div>
        <div class="kpi"><div class="kpi-label">Workouts</div><div class="kpi-value">${int(p.totalWorkouts)}</div><div class="kpi-note">all time</div></div>
        <div class="kpi"><div class="kpi-label">Time this week</div><div class="kpi-value">${int(weekMin)}<small>min</small></div><div class="kpi-note">7 UTC days to today</div></div>
        <div class="kpi"><div class="kpi-label">Distance this week</div><div class="kpi-value">${km(mine.filter((w) => w.dayId > TODAY - 7).reduce((s, w) => s + w.distanceM, 0), 1)}<small>km</small></div><div class="kpi-note">7 UTC days to today</div></div>
      </div>

      <section class="panel">
        <header><h2>Minutes by day</h2><span class="meta">${dayDate(week[0])} – today</span></header>
        <div class="chart" data-week></div>
      </section>

      <section class="panel">
        <header><h2>Recent workouts</h2><a class="card-link" href="/app/athlete.html?a=${me}">All ${int(p.totalWorkouts)}</a></header>
        <div class="table-wrap"><table class="workouts">${WORKOUT_HEAD}<tbody>${[...mine].reverse().slice(0, 6).map((w) => workoutRow(w)).join('')}</tbody></table></div>
      </section>
    </div>
    <aside class="stack">${myChallenges()}${weekBoard()}</aside>`;

  window.Charts.bars($('[data-week]'), {
    labels: week.map((d) => (d === TODAY ? 'Today' : weekday(d))),
    values: perDay,
    height: 180,
    format: (v) => `${v} min`,
    tickFormat: (v) => String(v),
  });
}
