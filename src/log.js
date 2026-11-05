import { connectWallet, mountShell } from './shell.js';
import { TODAY, challenges } from './data.js';
import { ACTIVITIES, ACTIVITY_ORDER, NOTE_MAX, basePoints, buckets, multiplierTenths, nextStreak, pointsFor } from './rules.js';
import { logWorkout } from './chain.js';
import { DEX_URL, txHref } from './config.js';
import { client } from './rpc.js';
import { int, plural, shortHash } from './format.js';
import { FLAME, PHASE, chain, esc } from './ui.js';

const { me, meA } = mountShell({ page: 'log', crumb: 'Runar / <b>Log workout</b>' });
const $ = (s) => document.querySelector(s);
const form = $('[data-form]');
const preview = $('[data-preview]');

const params = new URLSearchParams(location.search);
const state = { activity: ACTIVITIES[params.get('type')] ? params.get('type') : 'run', busy: false };

// ---- the line under the title: the finding --------------------------------------------------------
function untilMidnight() {
  const left = (TODAY + 1) * 86400 - Date.now() / 1000;
  const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
  return `${h} h ${m} min`;
}
function subline() {
  const sub = $('[data-sub]');
  if (!meA) { sub.textContent = 'One transaction. Your streak, points and challenges update with it.'; return; }
  const p = meA.profile;
  if (meA.loggedToday) sub.innerHTML = `You've logged today. Another workout adds points; the streak stays at <b>${plural(p.streak, 'day')}</b>.`;
  else if (meA.currentStreak) sub.innerHTML = `Log today to make it <b>${meA.currentStreak + 1} days</b>. The day ends at 00:00 UTC, ${untilMidnight()} from now.`;
  else sub.innerHTML = `Your next workout starts a new streak at <b>1 day</b>. Days run on UTC.`;
}
subline();

// ---- not connected ---------------------------------------------------------------------------------
if (!me) {
  $('[data-connect-notice]').hidden = false;
  $('[data-connect-inline]').addEventListener('click', (e) => connectWallet(e.currentTarget));
}

// Enough for a typical log (95k gas at 20 gwei is 0.0019 BOT); a first log can take about twice that.
const LOW_BALANCE = 4_000_000_000_000_000n;
if (me) {
  client.getBalance({ address: me }).then((b) => { state.balance = b; render(); }).catch(() => {});
}

// ---- activity picker -------------------------------------------------------------------------------
const acts = $('[data-acts]');
acts.innerHTML = ACTIVITY_ORDER.map((id) => `<button type="button" class="act" role="radio" data-act="${id}" aria-checked="${id === state.activity}" tabindex="${id === state.activity ? 0 : -1}"><b>${ACTIVITIES[id].label}</b><span>${ACTIVITIES[id].weight} ${ACTIVITIES[id].weight === 1 ? 'point' : 'points'} / 10 min</span></button>`).join('');
function setActivity(id, focus = false) {
  state.activity = id;
  acts.querySelectorAll('.act').forEach((b) => {
    const on = b.dataset.act === id;
    b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  const gym = !ACTIVITIES[id].hasDistance;
  $('[data-distance]').hidden = gym;
  $('[data-gym-line]').hidden = !gym;
  render();
}
acts.addEventListener('click', (e) => { const b = e.target.closest('.act'); if (b) setActivity(b.dataset.act); });
acts.addEventListener('keydown', (e) => {
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (!d) return;
  e.preventDefault();
  const i = ACTIVITY_ORDER.indexOf(state.activity);
  setActivity(ACTIVITY_ORDER[(i + d + ACTIVITY_ORDER.length) % ACTIVITY_ORDER.length], true);
});

// ---- duration, distance, note ---------------------------------------------------------------------
const noteBytes = () => new TextEncoder().encode(form.note.value).length;
const durationSec = () => (+form.h.value || 0) * 3600 + (+form.m.value || 0) * 60 + (+form.s.value || 0);
const distanceM = () => {
  if (!ACTIVITIES[state.activity].hasDistance) return 0;
  const v = parseFloat(String(form.km.value).replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? Math.round(v * 1000) : 0;
};
form.querySelectorAll('.quick .chip').forEach((c) => c.addEventListener('click', () => {
  const min = +c.dataset.min;
  form.h.value = Math.floor(min / 60); form.m.value = min % 60; form.s.value = 0;
  render();
}));
form.addEventListener('input', render);
form.addEventListener('submit', (e) => e.preventDefault());

// ---- the preview: what this workout will earn -------------------------------------------------------
function render() {
  const sec = durationSec();
  const noteOk = noteBytes() <= NOTE_MAX;
  const valid = sec > 0 && sec <= 86400 && noteOk;
  $('[data-dur-error]').hidden = sec > 0 && sec <= 86400;
  form.querySelectorAll('.quick .chip').forEach((c) => c.setAttribute('aria-pressed', sec === c.dataset.min * 60));
  $('[data-count]').textContent = noteBytes();
  if (state.busy || state.done) return;

  const a = ACTIVITIES[state.activity];
  const step = meA ? nextStreak(meA.profile, TODAY) : { streak: 1, rule: 'first' };
  const streak = step.streak;
  const base = valid ? basePoints(state.activity, sec) : 0;
  const pts = valid ? pointsFor(state.activity, sec, streak) : 0;
  const mult = (multiplierTenths(streak) / 10).toFixed(1);

  const streakText = !meA ? 'Connect a wallet to see your streak.'
    : step.rule === 'same-day' ? `Second workout today: the streak stays at <b>${plural(streak, 'day')}</b>.`
    : step.rule === 'next-day' ? `Streak <b>${streak - 1} → ${streak} days</b>.`
    : `Starts a new streak at <b>1 day</b>.`;

  const counting = meA ? challenges.filter((c) => c.joined && c.status === 'open' && (ACTIVITIES[state.activity].bit & c.mask)) : [];
  const counts = counting.length
    ? `<ul class="counts">${counting.map((c) => `<li><span>${esc(c.name)}</span><span class="muted">${c.goalType === 'distance' ? (distanceM() ? `+${(distanceM() / 1000).toFixed(2)} km` : 'no distance yet') : '+1 workout'}</span></li>`).join('')}</ul>`
    : `<p class="small">${meA ? 'None of your open challenges count this activity.' : 'Joined challenges show here.'}</p>`;

  preview.innerHTML = `
    <header><h2>This workout</h2><span class="meta">${a.label}</span></header>
    <div class="answer"><b>+${int(pts)}</b><span>points</span></div>
    <dl class="calc">
      <div><dt>${a.label} · ${a.weight} per 10 min</dt><dd>× ${valid ? buckets(sec) : 0} ${buckets(sec) === 1 ? 'block' : 'blocks'} = ${base}</dd></div>
      <div><dt>Streak multiplier, day ${streak}</dt><dd>× ${mult}</dd></div>
    </dl>
    <div class="streak-line">${FLAME(!!meA)}<p>${streakText}</p></div>
    <div><h3 class="rail-head">Counts toward</h3>${counts}</div>
    <button class="btn primary big block" type="button" data-submit ${!me || !valid ? 'disabled' : ''}>${me ? 'Sign and log' : 'Connect a wallet to log'}</button>
    <p class="small">${!noteOk ? 'Shorten the note to log.' : !valid ? 'Add a duration of up to 24 hours to log.'
      : state.balance !== undefined && state.balance < LOW_BALANCE ? `This wallet may be low on gas. <a class="tx" href="${DEX_URL}" target="_blank" rel="noopener">Get BOT</a>`
      : 'One transaction. About 0.002–0.004 BOT in gas.'}</p>`;
  preview.querySelector('[data-submit]').addEventListener('click', submit);
  $('[data-dock-pts]').textContent = `+${int(pts)}`;
  const dockBtn = $('[data-dock-submit]');
  dockBtn.disabled = !me || !valid;
  dockBtn.textContent = me ? 'Sign and log' : 'Connect to log';
}
$('[data-dock-submit]').addEventListener('click', () => {
  preview.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  submit();
});
// the dock steps aside once the preview's own button is on screen
new IntersectionObserver(([e]) => $('[data-dock]').classList.toggle('is-hidden', e.isIntersecting || !!state.done)).observe(preview);

// ---- submit: signing → confirming → confirmed ------------------------------------------------------
async function submit() {
  if (state.busy || durationSec() <= 0) return;
  state.busy = true;
  const btn = preview.querySelector('[data-submit]');
  btn.disabled = true;
  const status = preview.querySelector('.small:last-child');
  const before = meA.currentStreak;
  const beforePts = meA.profile.points;
  try {
    const w = await logWorkout({ activity: state.activity, durationSec: durationSec(), distanceM: distanceM(), note: form.note.value.slice(0, NOTE_MAX) },
      (phase) => { btn.textContent = PHASE[phase]; status.textContent = phase === 'signing' ? 'Check your wallet.' : 'Usually about a second.'; });
    state.done = true;
    confirmed(w, before, beforePts);
  } catch (e) {
    state.busy = false;
    btn.disabled = false; btn.textContent = 'Sign and log';
    status.innerHTML = `<span class="error-line">${esc(e.message)}</span>`;
  }
}

function confirmed(w, before, beforePts) {
  const pts = w.points;
  const id = w.workoutId;
  const after = w.streak;
  const sameDay = meA.loggedToday;
  form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = true; });
  preview.innerHTML = `
    <header><h2>Logged</h2><span class="meta">Confirmed in ${(w.confirmMs / 1000).toFixed(1)} s</span></header>
    <div class="done-head">
      <span class="mini-bib new"><b>${id}</b><span>${ACTIVITIES[w.activity].label} · today</span></span>
      <div>
        <div class="answer"><b>+<span class="roll" data-roll-pts>0</span></b><span>points</span></div>
        <p class="small">Total <span class="num" data-roll-total>${int(beforePts)}</span></p>
      </div>
    </div>
    <div class="streak-line">${FLAME(true)}<p>${sameDay ? `Streak stays at <b>${plural(after, 'day')}</b>` : `Streak <b><span class="roll" data-roll-streak>${before}</span> ${after === 1 ? 'day' : 'days'}</b>`}</p></div>
    <div data-chain>${chain(me, 14)}</div>
    <p>Transaction <a class="tx num" href="${txHref(w.tx)}" target="_blank" rel="noopener">${shortHash(w.tx)}</a> · workout #${id}</p>
    <div class="grid-2"><a class="btn primary big block" href="/app/">Back to dashboard</a><a class="btn big block" href="/app/log.html?type=${w.activity}">Log another</a></div>`;
  const today = preview.querySelector('.chain li.today');
  today.classList.add('on', 'new');
  const prev = today.previousElementSibling;
  if (prev && prev.classList.contains('on')) prev.classList.add('link');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const roll = (el, from, to, ms = 600, f = int) => {
    if (!el) return;
    if (reduce) { el.textContent = f(to); return; }
    const t0 = performance.now();
    const tick = (t) => { const p = Math.min((t - t0) / ms, 1); el.textContent = f(Math.round(from + (to - from) * (1 - (1 - p) ** 3))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  roll(preview.querySelector('[data-roll-pts]'), 0, pts);
  roll(preview.querySelector('[data-roll-total]'), beforePts, beforePts + pts);
  roll(preview.querySelector('[data-roll-streak]'), before, after, 500);
  $('[data-sub]').innerHTML = `Workout #${id} is on the record. ${plural(after, 'day')} and counting.`;
}

setActivity(state.activity);
