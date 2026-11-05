import { connectWallet, mountShell, notify } from './shell.js';
import { TODAY, athleteBy, challenges } from './data.js';
import { ACTIVITIES, ACTIVITY_ORDER } from './rules.js';
import { createChallenge, joinChallenge } from './chain.js';
import { dayDate, km, nameOf, ordinal, plural } from './format.js';
import { PHASE, avatar, esc } from './ui.js';

const { me } = mountShell({ page: 'challenges', crumb: 'Runar / <b>Challenges</b>' });
const $ = (s) => document.querySelector(s);

const GROUPS = {
  open: { label: 'Open', has: (c) => c.status === 'open' },
  upcoming: { label: 'Upcoming', has: (c) => c.status === 'upcoming' },
  finished: { label: 'Finished', has: (c) => c.status === 'ended' || c.status === 'closed' },
};
const asked = new URLSearchParams(location.search).get('tab');
let group = GROUPS[asked] ? asked : 'open';

const stat = (c, r) => (c.goalType === 'distance' ? `${km(r.distanceM, 1)} km` : plural(r.count, 'workout'));
function when(c) {
  const range = `${dayDate(c.startDay)} – ${dayDate(c.endDay)}`;
  if (c.status === 'open') return `${range}<span class="sub">${plural(c.endDay - TODAY + 1, 'day')} left</span>`;
  if (c.status === 'upcoming') return `${range}<span class="sub">starts in ${plural(c.startDay - TODAY, 'day')}</span>`;
  if (c.status === 'ended') return `${range}<span class="sub">ended, not closed yet</span>`;
  return `${range}<span class="sub">closed</span>`;
}
function leader(c) {
  if (c.status === 'upcoming' || !c.standings.length) return '<span class="muted">—</span>';
  const top = c.status === 'closed' ? c.winner : c.standings[0];
  if (!top || top.stat === 0) return '<span class="muted">No qualifying workouts yet</span>';
  const a = athleteBy(top.address);
  return `<span class="who">${avatar(a, 'sm')}<span>${esc(nameOf(a))}<span class="sub">${c.status === 'closed' ? 'won with ' : ''}${stat(c, top)}</span></span></span>`;
}
function you(c) {
  const r = c.standings.find((x) => x.address === me);
  if (r) return `<span class="pill pos">Joined</span>${c.status === 'upcoming' ? '' : `<span class="sub">${ordinal(r.rank)} · ${stat(c, r)}</span>`}`;
  if (c.status === 'open' || c.status === 'upcoming') return `<button class="btn" type="button" data-join="${c.id}">Join</button>`;
  if (c.status === 'ended') return `<a class="btn" href="/app/challenge.html?id=${c.id}">Close it</a>`;
  return '<span class="muted">—</span>';
}

function render() {
  const counts = Object.fromEntries(Object.entries(GROUPS).map(([k, g]) => [k, challenges.filter(g.has).length]));
  $('[data-tabs]').innerHTML = Object.entries(GROUPS).map(([k, g]) => `<button role="tab" data-tab="${k}" aria-selected="${k === group}" tabindex="${k === group ? 0 : -1}">${g.label}<span class="count">${counts[k]}</span></button>`).join('');
  const rows = challenges.filter(GROUPS[group].has);
  $('[data-table]').innerHTML = `<thead><tr><th>Challenge</th><th>Window</th><th class="n">Athletes</th><th class="col-lead">${group === 'finished' ? 'Winner' : 'Leading'}</th><th class="n">You</th></tr></thead>
    <tbody>${rows.length ? rows.map((c) => `<tr>
      <td><a class="cname" href="/app/challenge.html?id=${c.id}"><b>${esc(c.name)}</b><span class="sub">${esc(c.rule)}</span></a></td>
      <td class="num">${when(c)}</td>
      <td class="n num">${c.participants}</td>
      <td class="col-lead">${leader(c)}</td>
      <td class="n">${you(c)}</td></tr>`).join('')
    : `<tr><td colspan="5"><p class="empty">No ${GROUPS[group].label.toLowerCase()} challenges right now.</p></td></tr>`}</tbody>`;

  const ended = challenges.filter((c) => c.status === 'ended');
  $('[data-sub]').innerHTML = `${plural(counts.open, 'challenge')} open${me ? `, ${challenges.filter((c) => c.status === 'open' && !c.joined).length} you haven’t joined` : ''}.`
    + (ended.length ? ` <b>${esc(ended[0].name)}</b> ended ${plural(TODAY - ended[0].endDay, 'day')} ago and is waiting for anyone to close it.` : '');

  // the next two questions: what can be closed now, and who won lately
  const ready = challenges.filter((c) => c.status === 'ended');
  const won = challenges.filter((c) => c.status === 'closed');
  $('[data-below]').innerHTML = `
    <section class="panel span-6"><header><h2>Ready to close</h2><span class="meta">Anyone can close after the end day</span></header>
      ${ready.length ? `<ul class="mych">${ready.map((c) => `<li><a href="/app/challenge.html?id=${c.id}"><b>${esc(c.name)}</b><span class="muted">Ended ${dayDate(c.endDay)} · ${plural(c.participants, 'athlete')}</span></a><a class="btn" href="/app/challenge.html?id=${c.id}">Close it</a></li>`).join('')}</ul>`
        : '<p class="empty">Nothing is waiting to be closed.</p>'}
    </section>
    <section class="panel span-6"><header><h2>Recent winners</h2><span class="meta">Named by the contract at close</span></header>
      ${won.length ? `<ul class="mych">${won.map((c) => { const a = c.winner && athleteBy(c.winner.address); return `<li><a href="/app/challenge.html?id=${c.id}"><b>${esc(c.name)}</b><span class="muted">Closed after ${dayDate(c.endDay)}</span></a>${a ? `<span class="who">${avatar(a, 'sm')}<span>${esc(nameOf(a))}<span class="sub">${stat(c, c.winner)}</span></span></span>` : '<span class="muted">No winner</span>'}</li>`; }).join('')}</ul>`
        : '<p class="empty">No challenge has closed yet.</p>'}
    </section>`;

  const tabs = [...document.querySelectorAll('[data-tab]')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => { group = b.dataset.tab; history.replaceState(null, '', `?tab=${group}`); render(); $(`[data-tab="${group}"]`).focus(); });
    b.addEventListener('keydown', (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) tabs[(i + d + tabs.length) % tabs.length].click(); });
  });
  document.querySelectorAll('[data-join]').forEach((b) => b.addEventListener('click', async () => {
    if (!me) { connectWallet(b); return; }
    b.disabled = true;
    try {
      await joinChallenge(+b.dataset.join, (p) => { b.textContent = p === 'signing' ? 'Sign in wallet…' : 'Confirming…'; });
      location.reload();
    } catch (e) {
      b.disabled = false;
      b.textContent = 'Join';
      notify(e.message);
    }
  }));
}
render();

// ---- create sheet -----------------------------------------------------------------------------------
const sheet = $('[data-sheet]'), scrim = $('[data-scrim]'), form = $('[data-create-form]');
const iso = (day) => new Date(day * 86400000).toISOString().slice(0, 10);
$('[data-checks]').innerHTML = ACTIVITY_ORDER.map((id) => `<label class="check"><input type="checkbox" name="act" value="${id}" ${id === 'run' ? 'checked' : ''}> ${ACTIVITIES[id].label}</label>`).join('');
form.start.value = iso(TODAY + 1); form.end.value = iso(TODAY + 14); form.start.min = iso(TODAY); form.end.min = iso(TODAY);
form.goal.addEventListener('change', () => { $('[data-param]').hidden = form.goal.value !== 'reach'; });
let opener = null;
const open = () => { opener = document.activeElement; sheet.hidden = false; scrim.hidden = false; form.name.focus(); };
const close = () => { sheet.hidden = true; scrim.hidden = true; opener?.focus(); };
$('[data-create]').addEventListener('click', (e) => { if (!me) { connectWallet(e.currentTarget); return; } open(); });
$('[data-close]').addEventListener('click', close);
scrim.addEventListener('click', close);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('[data-form-error]');
  const startDay = Math.floor(Date.parse(form.start.value) / 86400000), endDay = Math.floor(Date.parse(form.end.value) / 86400000);
  const acts = [...form.querySelectorAll('[name=act]:checked')].map((i) => i.value);
  const problem = !form.name.value.trim() ? 'Give the challenge a name.'
    : !(startDay >= TODAY) ? 'The start day can’t be in the past.'
    : !(endDay >= startDay) ? 'The end day must be on or after the start day.'
    : endDay - startDay >= 366 ? 'A challenge can run for 366 days at most.'
    : !acts.length ? 'Pick at least one activity.' : '';
  err.hidden = !problem; err.textContent = problem;
  if (problem) return;
  const mask = acts.reduce((m, id) => m | ACTIVITIES[id].bit, 0);
  const goal = form.goal.value;
  const btn = $('[data-create-submit]');
  btn.disabled = true;
  try {
    const { id } = await createChallenge({ name: form.name.value.trim(), mask, goalType: goal, goalParam: goal === 'reach' ? +form.param.value : 0, startDay, endDay },
      (p) => { btn.textContent = PHASE[p]; });
    location.href = `/app/challenge.html?id=${id}`;
  } catch (ex) {
    btn.disabled = false;
    btn.textContent = 'Create challenge';
    err.hidden = false;
    err.textContent = ex.message;
  }
});
