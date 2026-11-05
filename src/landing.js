import { ACTIVITIES, multiplierTenths, pointsFor } from './rules.js';
import { duration, km, plural, shortAddr, shortHash, weekday, dayDate } from './format.js';
import { txHref } from './config.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TODAY = Math.floor(Date.now() / 86400000);

// ---- Hero: the bib holds, then shrinks to a stub in the bottom-left corner ----------------------
{
  const hero = $('.hero');
  const bib = $('[data-bib]');
  if (!reduced && hero && bib) {
    let base = null;
    const measure = () => { bib.style.transform = ''; base = bib.getBoundingClientRect(); };
    const frame = () => {
      const run = hero.offsetHeight - innerHeight;
      const p = Math.min(Math.max(scrollY / run, 0), 1);
      const e = p * p * (3 - 2 * p);
      const m = innerWidth < 640 ? 16 : 32;
      const s = 1 - e * (1 - Math.min(140 / base.width, .3));
      const x = (m - base.left) * e;
      const y = (innerHeight - m - base.bottom) * e;
      bib.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    };
    measure();
    addEventListener('resize', () => { measure(); frame(); });
    addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true });
    frame();
  }
}

// ---- The live thing: the streak rule on fourteen days ------------------------------------------
{
  const root = $('[data-tracker]');
  const list = $('[data-days]', root);
  const counts = [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 0];
  const n = counts.length;
  const todayIdx = n - 1;
  let lastTouched = null;

  function evaluate() {
    let streak = 0, best = 0, last = null;
    const linked = new Array(n).fill(false);
    counts.forEach((c, i) => {
      if (!c) return;
      if (last === null || i - last > 1) streak = 1;
      else if (i - last === 1) { streak += 1; linked[last] = true; }
      best = Math.max(best, streak);
      last = i;
    });
    const alive = last !== null && todayIdx - last <= 1;
    return { current: alive ? streak : 0, best, last, linked, loggedToday: last === todayIdx };
  }

  function ruleText(r) {
    const nextStreak = r.loggedToday ? r.current : r.current + 1;
    const pts = pointsFor('run', 1800, Math.max(nextStreak, 1));
    if (lastTouched === null) {
      return `Yesterday kept the run going. Log today and it becomes ${nextStreak} days; a 30-minute run would earn ${pts} points.`;
    }
    const i = lastTouched, c = counts[i];
    const before = (() => { for (let j = i - 1; j >= 0; j--) if (counts[j]) return j; return null; })();
    const day = i === todayIdx ? 'Today' : weekday(TODAY - (todayIdx - i));
    if (c === 0) return `${day} cleared. Current streak is ${r.current} ${r.current === 1 ? 'day' : 'days'}, best is ${r.best}.`;
    if (c === 2) return `${day}: a second workout the same day. It earns points; the streak stays where it was.`;
    if (before === null) return `${day} is the first workout on the strip, so the streak starts at 1.`;
    if (i - before === 1) return `${day} is the day after the last workout: the streak goes up by one. A 30-minute run today would earn ${pts} points.`;
    const gap = i - before - 1;
    return `${day} comes after a gap of ${gap} ${gap === 1 ? 'day' : 'days'}, so the streak starts again at 1.`;
  }

  function render() {
    const r = evaluate();
    list.innerHTML = '';
    counts.forEach((c, i) => {
      const dayId = TODAY - (todayIdx - i);
      const li = document.createElement('li');
      if (r.linked[i]) li.className = 'is-linked';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `day${c ? ` is-${c}` : ''}${i === todayIdx ? ' is-today' : ''}`;
      b.setAttribute('aria-pressed', c ? 'true' : 'false');
      const label = i === todayIdx ? 'Today' : weekday(dayId);
      b.setAttribute('aria-label', `${label} ${dayDate(dayId)}: ${c === 0 ? 'no workout' : c === 1 ? 'one workout' : 'two workouts'}`);
      b.innerHTML = `<span class="day__wd">${label}</span><span class="day__count">${c}</span>`;
      b.addEventListener('click', () => {
        counts[i] = (counts[i] + 1) % 3;
        lastTouched = i;
        render();
        list.children[i].querySelector('button').focus();
      });
      li.append(b);
      list.append(li);
    });
    const nextStreak = r.loggedToday ? r.current : r.current + 1;
    $('[data-out-streak]').textContent = `${r.current} ${r.current === 1 ? 'day' : 'days'}`;
    $('[data-out-best]').textContent = `${r.best} ${r.best === 1 ? 'day' : 'days'}`;
    $('[data-out-mult]').textContent = `×${(multiplierTenths(Math.max(nextStreak, 1)) / 10).toFixed(1)}`;
    $('[data-out-multlab]').textContent = r.loggedToday ? "multiplier on today's next workout" : "multiplier on today's workout";
    $('[data-out-rule]').textContent = ruleText(r);
  }
  render();
}

// ---- Tabs ---------------------------------------------------------------------------------------
{
  const tabs = $$('[data-tabs] [role=tab]');
  const select = (t) => {
    tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      select(next); next.focus();
    });
  });
}

// ---- Index cards: one open at a time -----------------------------------------------------------
{
  const cards = $$('[data-cards] .card');
  cards.forEach((card, i) => {
    card.style.setProperty('--i', i);
    card.style.zIndex = i + 1;
    const btn = $('button', card);
    btn.addEventListener('click', () => {
      cards.forEach((c) => {
        const on = c === card && !card.classList.contains('is-open');
        c.classList.toggle('is-open', on);
        $('button', c).setAttribute('aria-expanded', on);
      });
    });
  });
}

let nextId = 1;
let setNextId = () => {};

// ---- The blank in the closing sentence fits the word chosen -------------------------------------
{
  const sel = $('#cta-type');
  const probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit;font-weight:600';
  sel.parentElement.append(probe);
  const fit = () => {
    if (matchMedia('(max-width: 640px)').matches) { sel.style.removeProperty('--w'); return; }
    probe.textContent = sel.options[sel.selectedIndex].text;
    sel.style.setProperty('--w', `calc(${probe.getBoundingClientRect().width}px + 1.2em)`);
  };
  // the preview bib: the number the next workout on the chain will get
  const preview = () => {
    $('[data-next-id]').textContent = nextId;
    $('[data-next-what]').textContent = `Logged now, your ${sel.options[sel.selectedIndex].text} would be workout ${nextId} on the record.`;
  };
  setNextId = (id) => { nextId = id; preview(); };
  preview();
  sel.addEventListener('change', preview);
  sel.addEventListener('change', fit);
  addEventListener('resize', fit);
  document.fonts.ready.then(fit);
  fit();
}

// ---- Reveal once, and the clip only plays while it is on screen --------------------------------
{
  const targets = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    targets.forEach((t) => io.observe(t));
    // A jump (an anchor link, a fast fling) can skip past a section; reveal everything above the fold line.
    const catchUp = () => targets.forEach((t) => { if (!t.classList.contains('is-in') && t.getBoundingClientRect().top < innerHeight) t.classList.add('is-in'); });
    addEventListener('scroll', () => requestAnimationFrame(catchUp), { passive: true });
    addEventListener('load', () => setTimeout(() => targets.forEach((t) => {
      const r = t.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) t.classList.add('is-in');
    }), 2500));

    const video = $('.compete__film video');
    if (reduced) { video.removeAttribute('autoplay'); video.pause(); }
    else new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause()))).observe(video);
  } else targets.forEach((t) => t.classList.add('is-in'));
}

// ---- Live figures. Loaded last, so a slow or unreachable RPC never holds up the page ----------------
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

import('./data.js').then(({ athleteBy, challenges, chainStatus, lastWorkout, workouts }) => {
  if (!chainStatus.ok && !workouts.length) return;
  setNextId(workouts.length + 1);

  // the bib: the most recent workout on the chain
  const w = lastWorkout();
  if (w) {
    $('[data-bib-id]').textContent = w.workoutId;
    $('[data-bib-what]').textContent = [ACTIVITIES[w.activity].label, w.distanceM ? `${km(w.distanceM)} km` : null, duration(w.durationSec)].filter(Boolean).join(' \u00b7 ');
    $('[data-bib-streak]').textContent = `Day ${w.streakAfter}`;
    const tx = $('[data-bib-tx]');
    tx.textContent = `tx ${shortHash(w.tx)}`;
    tx.href = txHref(w.tx);
  }

  // Genesis, once it has been opened
  const c = challenges.find((x) => x.name === 'Genesis 7-day');
  if (!c) return;
  $('[data-gen-link]').href = `/app/challenge.html?id=${c.id}`;
  const state = c.status === 'closed' ? 'closed' : c.status === 'upcoming' ? `starts ${dayDate(c.startDay)}` : c.status === 'ended' ? 'ended' : `ends ${dayDate(c.endDay)}`;
  $('[data-gen-state]').textContent = `Log ${c.goalParam} or more workouts \u00b7 ${state} \u00b7 ${plural(c.participants, 'athlete')}`;
  $('[data-gen-rows]').innerHTML = c.standings.slice(0, 6).map((r) => {
    const a = athleteBy(r.address);
    const won = c.winner && c.winner.address === r.address;
    const pill = won ? '<span class="pill pill--win">Winner</span>'
      : r.count >= c.goalParam ? '<span class="pill pill--done">Goal met</span>' : '<span class="pill pill--short">Short</span>';
    return `<li><span class="standings__rank">${r.rank}</span><span class="standings__name">${esc(a.name || shortAddr(a.address))}</span><span class="standings__stat">${plural(r.count, 'workout')}</span>${pill}</li>`;
  }).join('');
}).catch(() => { /* the page reads fine without live figures */ });
