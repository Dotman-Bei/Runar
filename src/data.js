// Sample chain state for design at real density (docs/FRONTEND.md §6). Every aggregate is computed
// from the workouts with the contract's own rules (rules.js), never typed in, so figures that appear
// on several screens always agree. Replace with reads from Runar.sol once deployed.

import { ACTIVITIES, applyWorkout, dayIdOf, emptyProfile, liveStreak } from './rules.js';

export const TODAY = Math.floor(Date.now() / 86400000);
const HISTORY_DAYS = 42;

// Small seeded PRNG so the sample chain is the same on every load and every page.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexFrom(rand, len) {
  let h = '';
  for (let i = 0; i < len; i++) h += Math.floor(rand() * 16).toString(16);
  return h;
}

export const YOU = '0x7a3f91c2d04be6a85f1e3b7c90d2a4e6f81bc21e';

// Team wallets ran the Genesis challenge (PRD §5.3); the rest are early athletes.
const ATHLETES = [
  { address: YOU, name: 'tunde.runs', team: false, seed: 11, p: 0.55, acts: ['run', 'run', 'gym', 'walk'] },
  { address: '0x1b44e0a9c3d2f7e6b5a4908172635a4b3c2d1e0f', name: 'ama.lifts', team: true, seed: 23, p: 0.86, acts: ['gym', 'gym', 'gym', 'run'] },
  { address: '0x2c9d7e1f0a3b5c4d6e8f90a1b2c3d4e5f6a7b8c9', name: 'lena.swims', team: true, seed: 37, p: 0.7, acts: ['swim', 'swim', 'run', 'gym'] },
  { address: '0x3d8a6b5c4e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b', name: 'marco_on_wheels', team: false, seed: 41, p: 0.6, acts: ['cycle', 'cycle', 'cycle', 'run'] },
  { address: '0x4e7f5a6b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f', name: 'priya.k', team: true, seed: 53, p: 0.74, acts: ['run', 'walk', 'run', 'swim'] },
  { address: '0x5f6e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e', name: 'jonas.trails', team: false, seed: 67, p: 0.5, acts: ['run', 'run', 'walk'] },
  { address: '0x6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b', name: 'sofia.m', team: false, seed: 71, p: 0.66, acts: ['gym', 'run', 'cycle', 'walk'] },
  { address: '0x7b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c', name: 'kenji.km', team: true, seed: 83, p: 0.9, acts: ['run', 'run', 'run', 'cycle'] },
  { address: '0x8c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d', name: 'noor.walks', team: false, seed: 97, p: 0.8, acts: ['walk', 'walk', 'walk', 'run'] },
  { address: '0x9d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e', name: 'ade.bench', team: false, seed: 101, p: 0.45, acts: ['gym', 'gym', 'walk'] },
  { address: '0xa1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2', name: null, team: false, seed: 113, p: 0.3, acts: ['run', 'cycle'] },
  { address: '0xb2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3', name: 'mateo.r', team: false, seed: 127, p: 0.58, acts: ['swim', 'cycle', 'run', 'gym'] },
];

// Typical sessions: minutes range and pace (seconds per km) per activity.
const SESSION = {
  run: { min: [22, 58], pace: [290, 390] },
  walk: { min: [25, 70], pace: [600, 720] },
  gym: { min: [40, 80], pace: null },
  cycle: { min: [35, 110], pace: [110, 150] },
  swim: { min: [25, 50], pace: [1100, 1500] },
};

const NOTES = {
  run: ['Easy loop by the river', 'Tempo, felt strong', 'Long run, legs heavy at the end', 'Intervals 6 × 800 m', 'Recovery jog'],
  walk: ['Lunch walk', 'Evening walk with the dog', 'Walked to work', ''],
  gym: ['Push day', 'Legs, squats 5 × 5', 'Pull day', 'Full body', ''],
  cycle: ['Hill repeats', 'Commute both ways', 'Group ride', ''],
  swim: ['1.5 k steady', 'Drills and kick sets', 'Open lane, good pace', ''],
};

function makeWorkout(rand, activity, day, hour) {
  const s = SESSION[activity];
  const minutes = Math.round(s.min[0] + rand() * (s.min[1] - s.min[0]));
  const durationSec = minutes * 60 + Math.floor(rand() * 60);
  const distanceM = s.pace ? Math.round((durationSec / (s.pace[0] + rand() * (s.pace[1] - s.pace[0]))) * 1000 / 10) * 10 : 0;
  const notes = NOTES[activity];
  return {
    activity,
    durationSec,
    distanceM,
    note: notes[Math.floor(rand() * notes.length)],
    timestamp: day * 86400 + Math.floor(hour * 3600 + rand() * 3000),
  };
}

function generate(a) {
  const rand = rng(a.seed);
  const out = [];
  for (let d = TODAY - HISTORY_DAYS; d <= TODAY; d++) {
    let logs;
    if (a.address === YOU) {
      // You: a 14-day streak ending yesterday, nothing yet today (the dashboard's finding).
      if (d === TODAY) logs = 0;
      else if (d >= TODAY - 14) logs = 1;
      else if (d === TODAY - 15) logs = 0;
      else logs = rand() < a.p ? 1 : 0;
      if (d === TODAY - 9) logs = 2;
    } else {
      logs = rand() < a.p ? 1 : 0;
      if (logs && rand() < 0.1) logs = 2;
      if (d === TODAY && rand() < 0.5) logs = 0;
    }
    for (let i = 0; i < logs; i++) {
      const act = a.acts[Math.floor(rand() * a.acts.length)];
      out.push(makeWorkout(rand, act, d, i === 0 ? 6 + rand() * 4 : 17 + rand() * 3));
    }
  }
  // You always ran yesterday: the hero's "Run · day 14" bib is this workout.
  if (a.address === YOU) {
    const y = out.filter((w) => dayIdOf(w.timestamp) === TODAY - 1);
    if (y.length) Object.assign(y[0], { activity: 'run', durationSec: 27 * 60 + 41, distanceM: 5020, note: 'Easy 5 k, negative split' });
  }
  return out;
}

// Build the chain: one global, time-ordered stream of WorkoutLogged events.
function buildChain() {
  const all = [];
  for (const a of ATHLETES) for (const w of generate(a)) all.push({ ...w, user: a.address });
  all.sort((x, y) => x.timestamp - y.timestamp);
  const txRand = rng(9001);
  const profiles = new Map(ATHLETES.map((a) => [a.address, emptyProfile()]));
  all.forEach((w, i) => {
    w.workoutId = i + 1;
    w.tx = '0x' + hexFrom(txRand, 64);
    const r = applyWorkout(profiles.get(w.user), w);
    w.points = r.pts;
    w.streakAfter = r.step.streak;
    w.dayId = r.dayId;
  });
  return { workouts: all, profiles };
}

const LOCAL_KEY = 'runar.local-workouts';

// Workouts logged in this browser through the mock wallet (chain.js), so the demo flow updates.
function localWorkouts() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
}
export function saveLocalWorkout(w) {
  try {
    const list = localWorkouts();
    list.push(w);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch { /* storage blocked: the confirm screen still shows the result */ }
}

const chain = buildChain();
for (const w of localWorkouts()) {
  w.workoutId = chain.workouts.length + 1;
  const r = applyWorkout(chain.profiles.get(YOU), w);
  Object.assign(w, { user: YOU, points: r.pts, streakAfter: r.step.streak, dayId: r.dayId });
  chain.workouts.push(w);
}

export const workouts = chain.workouts;

// Minutes per UTC day for the last 7 days, oldest first. The week total is always the sum of these.
export function weekByDay(list) {
  return [...Array(7)].map((_, i) => Math.round(list.filter((w) => w.dayId === TODAY - 6 + i).reduce((s, w) => s + w.durationSec, 0) / 60));
}

export const athletes = ATHLETES.map((a) => {
  const p = chain.profiles.get(a.address);
  const mine = workouts.filter((w) => w.user === a.address);
  const week = mine.filter((w) => w.dayId > TODAY - 7);
  return {
    address: a.address,
    name: a.name,
    team: a.team,
    profile: { ...p },
    currentStreak: liveStreak(p, TODAY),
    loggedToday: p.lastWorkoutDay === TODAY,
    weekMinutes: weekByDay(mine).reduce((s, m) => s + m, 0),
    weekKm: week.reduce((s, w) => s + w.distanceM, 0) / 1000,
    weekCount: week.length,
  };
});

export const athleteBy = (address) => athletes.find((a) => a.address.toLowerCase() === String(address).toLowerCase());
export const workoutsOf = (address) => workouts.filter((w) => w.user === address);
export const me = () => athleteBy(YOU);

// --- Challenges -------------------------------------------------------------------------------
// goalType: 'distance' (most metres), 'count' (most workouts), 'reach' (first to goalParam counts,
// ranked by count). Aggregates are kept per participant as the contract would at log time.

const C = [
  // closed: whether closeChallenge has been called. 'ended' = past endDay, waiting for anyone to close it.
  { id: 1, name: 'Genesis 7-day', rule: 'Log 3 or more workouts', mask: 31, goalType: 'reach', goalParam: 3,
    startDay: TODAY - 20, endDay: TODAY - 14, creator: ATHLETES[1].address, closed: true,
    members: [0, 1, 2, 4, 5, 6, 7, 8, 9] },
  { id: 2, name: 'Lunch walkers', rule: '5 walks in 7 days', mask: ACTIVITIES.walk.bit, goalType: 'reach', goalParam: 5,
    startDay: TODAY - 12, endDay: TODAY - 6, creator: ATHLETES[8].address, closed: false,
    members: [0, 4, 6, 8, 9] },
  { id: 3, name: 'Fourteen days of road', rule: 'Runs only · most distance', mask: ACTIVITIES.run.bit, goalType: 'distance', goalParam: 0,
    startDay: TODAY - 6, endDay: TODAY + 7, creator: ATHLETES[7].address, closed: false,
    members: [0, 4, 5, 7, 10, 11] },
  { id: 4, name: 'Swim club ten', rule: 'Swims only · most distance', mask: ACTIVITIES.swim.bit, goalType: 'distance', goalParam: 0,
    startDay: TODAY - 3, endDay: TODAY + 6, creator: ATHLETES[2].address, closed: false,
    members: [2, 4, 11] },
  { id: 5, name: 'Any sweat counts', rule: 'Any activity · most workouts', mask: 31, goalType: 'count', goalParam: 0,
    startDay: TODAY - 9, endDay: TODAY + 4, creator: ATHLETES[3].address, closed: false,
    members: [1, 3, 6, 7, 8, 9, 11] },
  { id: 6, name: 'Thirty days of iron', rule: 'Gym only · most sessions', mask: ACTIVITIES.gym.bit, goalType: 'count', goalParam: 0,
    startDay: TODAY + 4, endDay: TODAY + 33, creator: ATHLETES[9].address, closed: false,
    members: [1, 9] },
];

// Joins and closes sent from this browser through the mock wallet (chain.js).
const readSet = (k) => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
export const LOCAL_JOINS = 'runar.local-joins';
export const LOCAL_CLOSES = 'runar.local-closes';
export const LOCAL_CREATED = 'runar.local-challenges';
try {
  for (const c of JSON.parse(localStorage.getItem(LOCAL_CREATED) || '[]')) C.push({ ...c, creator: YOU, closed: false, members: [] });
} catch { /* storage blocked */ }
const joinedHere = readSet(LOCAL_JOINS);
const closedHere = readSet(LOCAL_CLOSES);
for (const c of C) {
  if (joinedHere.has(c.id) && !c.members.includes(0)) c.members.push(0);
  if (closedHere.has(c.id)) c.closed = true;
}

function standingsFor(c) {
  const rows = c.members.map((idx, joinOrder) => {
    const a = ATHLETES[idx];
    const counted = workouts.filter((w) => w.user === a.address && w.dayId >= c.startDay && w.dayId <= c.endDay
      && (ACTIVITIES[w.activity].bit & c.mask));
    const last = counted.length ? counted[counted.length - 1].dayId : null;
    return { address: a.address, joinOrder, count: counted.length, distanceM: counted.reduce((s, w) => s + w.distanceM, 0), lastDay: last };
  });
  const stat = (r) => (c.goalType === 'distance' ? r.distanceM : r.count);
  // Deterministic order, as closeChallenge would pick: higher stat first, earlier joiner on a tie.
  rows.sort((x, y) => stat(y) - stat(x) || x.joinOrder - y.joinOrder);
  rows.forEach((r, i) => { r.rank = i + 1; r.stat = stat(r); });
  return rows;
}

export const challenges = C.map((c) => {
  const standings = standingsFor(c);
  const status = c.closed ? 'closed' : c.startDay > TODAY ? 'upcoming' : c.endDay < TODAY ? 'ended' : 'open';
  const winner = c.closed && standings.length && standings[0].stat > 0 ? standings[0] : null;
  return { ...c, status, standings, participants: standings.length, winner, joined: standings.some((r) => r.address === YOU) };
});

export const challengeBy = (id) => challenges.find((c) => c.id === Number(id));

// Figures that must agree across screens.
for (const a of athletes) {
  const mine = workoutsOf(a.address);
  console.assert(mine.length === a.profile.totalWorkouts, 'workout count mismatch', a.name);
  console.assert(mine.reduce((s, w) => s + w.points, 0) === a.profile.points, 'points mismatch', a.name);
}
