import { mountShell } from './shell.js';
import { TODAY, athleteBy, challengeBy } from './data.js';
import { closeChallenge, connect, joinChallenge } from './chain.js';
import { dayDate, km, nameOf, ordinal, plural } from './format.js';
import { avatar, esc } from './ui.js';

const c = challengeBy(new URLSearchParams(location.search).get('id'));
const { me } = mountShell({ page: 'challenges', crumb: `<a href="/app/challenges.html">Challenges</a> / <b>${c ? esc(c.name) : 'Not found'}</b>` });
const root = document.querySelector('[data-root]');

if (!c) {
  root.innerHTML = `<div class="title-row"><div><h1>Challenge not found</h1><p class="sub">There is no challenge with that number on the contract.</p></div></div>
    <a class="btn" href="/app/challenges.html">All challenges</a>`;
} else {
  document.title = `${c.name} · Runar`;
  const unit = c.goalType === 'distance' ? 'km' : 'workouts';
  const stat = (r) => (c.goalType === 'distance' ? `${km(r.distanceM, 1)} km` : plural(r.count, 'workout'));
  const creator = athleteBy(c.creator);
  const mine = c.standings.find((r) => r.address === me);
  const closesAt = (c.endDay + 1) * 86400;

  // ---- actions: join before the end, close after it ------------------------------------------------
  let action = '';
  if (c.status === 'open' || c.status === 'upcoming') {
    action = mine ? '<span class="pill pos">Joined</span>' : '<button class="btn primary" type="button" data-join>Join challenge</button>';
    action += `<button class="btn" type="button" disabled>Can close after ${dayDate(c.endDay)}</button>`;
  } else if (c.status === 'ended') {
    action = '<button class="btn primary" type="button" data-close>Close challenge</button>';
  }

  // ---- the finding ------------------------------------------------------------------------------
  const lead = c.standings[0];
  const leadA = lead && athleteBy(lead.address);
  let finding;
  if (c.status === 'closed') finding = c.winner ? `Won by <b>${esc(nameOf(athleteBy(c.winner.address)))}</b> with ${stat(c.winner)}.` : 'Closed with no qualifying workouts, so there is no winner.';
  else if (c.status === 'ended') finding = `Ended on ${dayDate(c.endDay)}. Anyone can close it now; ${leadA && lead.stat ? `${esc(nameOf(leadA))} would win with ${stat(lead)}` : 'nobody qualified yet'}.`;
  else if (c.status === 'upcoming') finding = `Starts on ${dayDate(c.startDay)}, in ${plural(c.startDay - TODAY, 'day')}. ${plural(c.participants, 'athlete')} joined so far.`;
  else if (mine && mine.rank > 1 && lead.stat > 0) finding = `You’re <b>${ordinal(mine.rank)}</b>, ${c.goalType === 'distance' ? `${km(lead.distanceM - mine.distanceM, 1)} km` : plural(lead.count - mine.count, 'workout')} behind ${esc(nameOf(leadA))}.`;
  else if (mine && mine.rank === 1) finding = `You’re <b>leading</b> with ${stat(mine)}.`;
  else finding = leadA && lead.stat ? `${esc(nameOf(leadA))} leads with ${stat(lead)}.` : 'No qualifying workouts yet.';

  const rows = c.standings.map((r) => {
    const a = athleteBy(r.address);
    const reached = c.goalType === 'reach' && r.count >= c.goalParam;
    const winner = c.status === 'closed' && c.winner && c.winner.address === r.address;
    return `<tr class="${r.address === me ? 'me' : ''}">
      <td class="rank num">${r.rank}</td>
      <td><span class="who">${avatar(a)}<a href="/app/athlete.html?a=${a.address}"><span><b>${esc(nameOf(a))}</b>${r.address === me ? '<span class="you">you</span>' : ''}</span></a>${winner ? '<span class="pill hue">Winner</span>' : reached ? '<span class="pill pos">Goal met</span>' : ''}</span></td>
      <td class="n num fig-main">${c.goalType === 'distance' ? `${km(r.distanceM, 1)} <small class="muted">km</small>` : r.count}</td>
      <td class="n num col-2">${c.goalType === 'distance' ? r.count : `${km(r.distanceM, 1)} <small class="muted">km</small>`}</td>
      <td class="n num col-3">${r.lastDay != null ? dayDate(r.lastDay) : '<span class="muted">—</span>'}</td>
    </tr>`;
  }).join('');

  // ---- rail ----------------------------------------------------------------------------------------
  const progress = !mine ? '' : c.goalType === 'reach'
    ? `<section><h2 class="rail-head">Your progress</h2><div class="panel">
        <p class="answer-fig num">${Math.min(mine.count, c.goalParam)} <small class="muted">of ${c.goalParam}</small></p>
        <div class="bar" role="img" aria-label="${mine.count} of ${c.goalParam} workouts"><span style="width:${Math.min(mine.count / c.goalParam, 1) * 100}%"></span></div>
        <div class="bar-ends"><span>0</span><span>${c.goalParam} workouts</span></div></div></section>`
    : `<section><h2 class="rail-head">Your progress</h2><div class="panel">
        <p class="answer-fig num">${c.goalType === 'distance' ? `${km(mine.distanceM, 1)} <small class="muted">km</small>` : mine.count}</p>
        <p class="muted">${ordinal(mine.rank)} of ${c.participants}${mine.rank > 1 && lead.stat ? ` · leader at ${stat(lead)}` : ''}</p>
        ${lead.stat ? `<div class="bar" role="img" aria-label="Your total against the leader"><span style="width:${(mine.stat / lead.stat) * 100}%"></span></div><div class="bar-ends"><span>0</span><span>${stat(lead)}, leader</span></div>` : ''}
      </div></section>`;

  root.innerHTML = `
    <section class="panel objhead">
      <div class="objhead-text">
        <h1>${esc(c.name)}</h1>
        <p class="muted">${esc(c.rule)} · ${dayDate(c.startDay)} – ${dayDate(c.endDay)} · created by <a class="tx" href="/app/athlete.html?a=${c.creator}">${esc(nameOf(creator))}</a> · ${plural(c.participants, 'athlete')}</p>
      </div>
      <div class="title-actions" data-actions>${action}</div>
    </section>
    <p class="finding${c.status === 'closed' && c.winner ? ' won' : ''}">${finding}</p>
    <div class="split">
      <section class="panel">
        <header><h2>Standings</h2><span class="meta">${c.status === 'closed' ? 'Final, as closed' : 'Kept by the contract as workouts are logged'}</span></header>
        ${c.standings.length ? `<div class="table-wrap"><table class="ranks"><thead><tr><th class="rank">Rank</th><th>Athlete</th><th class="n">${c.goalType === 'distance' ? 'Distance' : 'Workouts'}</th><th class="n col-2">${c.goalType === 'distance' ? 'Workouts' : 'Distance'}</th><th class="n col-3">Last counted</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : '<p class="empty">Nobody has joined yet. If it closes like this, the contract records no winner.</p>'}
      </section>
      <aside class="stack">
        <section><h2 class="rail-head">${c.status === 'upcoming' ? 'Starts in' : c.status === 'open' ? 'Time left' : 'Window'}</h2>
          <div class="panel"><p class="answer-fig num" data-clock>${c.status === 'open' || c.status === 'upcoming' ? '' : `${plural(c.endDay - c.startDay + 1, 'day')}`}</p>
          <p class="muted">${c.status === 'open' ? `Counts workouts until 23:59 UTC on ${dayDate(c.endDay)}` : c.status === 'upcoming' ? `From 00:00 UTC on ${dayDate(c.startDay)}` : `${dayDate(c.startDay)} – ${dayDate(c.endDay)}, UTC`}</p></div></section>
        ${progress}
        <section><h2 class="rail-head">How it’s scored</h2><div class="panel"><p>${c.goalType === 'distance' ? 'Distance from every matching workout logged inside the window is added up.' : c.goalType === 'count' ? 'Every matching workout inside the window counts as one, same-day workouts included.' : `Every matching workout inside the window counts; reaching ${c.goalParam} meets the goal.`} At close, the highest total wins; on a tie, whoever joined first. Workouts logged after the end day still count toward your profile, not toward these standings.</p></div></section>
      </aside>
    </div>`;

  // live clock to the end (or the start)
  const clock = root.querySelector('[data-clock]');
  if (c.status === 'open' || c.status === 'upcoming') {
    const target = c.status === 'open' ? closesAt : c.startDay * 86400;
    const tick = () => {
      const s = Math.max(0, target - Date.now() / 1000);
      clock.textContent = `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
    };
    tick(); setInterval(tick, 30000);
  }

  const send = async (btn, fn) => {
    if (!me) { btn.textContent = 'Connecting…'; await connect(); location.reload(); return; }
    btn.disabled = true;
    await fn(c.id, (p) => { btn.textContent = p === 'signing' ? 'Sign in wallet…' : 'Confirming…'; });
    location.reload();
  };
  root.querySelector('[data-join]')?.addEventListener('click', (e) => send(e.currentTarget, joinChallenge));
  root.querySelector('[data-close]')?.addEventListener('click', (e) => send(e.currentTarget, closeChallenge));
}
