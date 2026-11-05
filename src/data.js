// Chain state, read from Runar.sol's events on BOT Chain. Pages import plain values from here: top-level await holds
// them until the chain has been read. Logs are cached in the browser, so a return visit only fetches what is new, and
// records stay readable offline (PRD §5.2). If the RPC fails, the cache is used and chainStatus says so.

import { parseEventLogs } from 'viem';
import { DEPLOY_BLOCK, TEAM_WALLETS } from './config.js';
import { ACTIVITIES, ACTIVITY_ORDER, liveStreak } from './rules.js';
import { abi, client, runar } from './rpc.js';
import { account } from './wallet.js';

export const TODAY = Math.floor(Date.now() / 86400000);

const CACHE_KEY = `runar.logs.v1.${runar.address.toLowerCase()}`;
const CHUNK = 100_000n;   // BOT Chain's RPC answers this span reliably; 1,000,000 failed when tested
const PARALLEL = 6;
const REWIND = 64n;       // re-read recent blocks in case the chain's tip changed since the last visit

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    return c && Array.isArray(c.logs) ? { synced: BigInt(c.synced), logs: c.logs, at: c.at } : null;
  } catch { return null; }
}
function writeCache(synced, logs) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ synced: String(synced), logs, at: Date.now() })); } catch { /* storage full or blocked */ }
}

// BigInts become numbers: every value here (ids, points, metres) stays far below 2^53.
function plain(log) {
  const args = {};
  for (const [k, v] of Object.entries(log.args)) args[k] = typeof v === 'bigint' ? Number(v) : v;
  return { name: log.eventName, tx: log.transactionHash, block: Number(log.blockNumber), index: log.logIndex, args };
}

async function fetchSpan(from, to) {
  try {
    const raw = await client.getLogs({ address: runar.address, fromBlock: from, toBlock: to });
    return parseEventLogs({ abi, logs: raw }).map(plain);
  } catch (e) {
    if (to - from < 1000n) throw e;
    const mid = (from + to) / 2n; // a span the node refuses is split, not given up on
    return [...await fetchSpan(from, mid), ...await fetchSpan(mid + 1n, to)];
  }
}

async function loadLogs() {
  const cache = readCache();
  const head = await client.getBlockNumber();
  let from = cache && cache.synced - REWIND > DEPLOY_BLOCK ? cache.synced - REWIND : DEPLOY_BLOCK;
  const spans = [];
  for (; from <= head; from += CHUNK) spans.push([from, from + CHUNK - 1n > head ? head : from + CHUNK - 1n]);

  const fresh = [];
  for (let i = 0; i < spans.length; i += PARALLEL) {
    const batch = await Promise.all(spans.slice(i, i + PARALLEL).map(([a, b]) => fetchSpan(a, b)));
    batch.forEach((b) => fresh.push(...b));
  }
  const seen = new Map();
  for (const log of [...(cache?.logs ?? []), ...fresh]) seen.set(`${log.tx}:${log.index}`, log);
  const logs = [...seen.values()].sort((a, b) => a.block - b.block || a.index - b.index);
  writeCache(head, logs);
  return logs;
}

export const chainStatus = { ok: true, cachedAt: null };
let logs;
try {
  logs = await loadLogs();
} catch (e) {
  console.warn('Could not read BOT Chain', e);
  const cache = readCache();
  logs = cache?.logs ?? [];
  chainStatus.ok = false;
  chainStatus.cachedAt = cache?.at ?? null;
}

const of = (name) => logs.filter((l) => l.name === name);

// ---- workouts ---------------------------------------------------------------------------------------
export const workouts = of('WorkoutLogged').map((l) => ({
  user: l.args.user,
  workoutId: l.args.workoutId,
  activity: ACTIVITY_ORDER[l.args.activityType],
  durationSec: l.args.durationSec,
  distanceM: l.args.distanceM,
  dayId: l.args.dayId,
  timestamp: l.args.timestamp,
  points: l.args.points,
  streakAfter: l.args.streak,
  note: l.args.note,
  tx: l.tx,
})).sort((a, b) => a.workoutId - b.workoutId);

export const workoutsOf = (address) => workouts.filter((w) => w.user.toLowerCase() === String(address).toLowerCase());
export const lastWorkout = () => workouts[workouts.length - 1] ?? null;

// Minutes per UTC day for the last 7 days, oldest first. The week total is always the sum of these.
export function weekByDay(list) {
  return [...Array(7)].map((_, i) => Math.round(list.filter((w) => w.dayId === TODAY - 6 + i).reduce((s, w) => s + w.durationSec, 0) / 60));
}

// ---- athletes ---------------------------------------------------------------------------------------
const names = new Map();
for (const l of of('DisplayNameSet')) names.set(l.args.user, l.args.name || null);

const known = new Set([
  ...workouts.map((w) => w.user),
  ...names.keys(),
  ...of('ChallengeJoined').map((l) => l.args.user),
  ...of('ChallengeCreated').map((l) => l.args.creator),
]);
if (account()) known.add(account());

const teamSet = new Set(TEAM_WALLETS.map((a) => a.toLowerCase()));

export const athletes = [...known].map((address) => {
  const mine = workoutsOf(address);
  const last = mine[mine.length - 1];
  // what WorkoutLogged recorded, so the athlete page's replay is a real comparison against getProfile
  const profile = {
    totalWorkouts: mine.length,
    streak: last ? last.streakAfter : 0,
    bestStreak: mine.reduce((m, w) => Math.max(m, w.streakAfter), 0),
    points: mine.reduce((s, w) => s + w.points, 0),
    lastWorkoutDay: last ? last.dayId : null,
  };
  const week = mine.filter((w) => w.dayId > TODAY - 7);
  return {
    address,
    name: names.get(address) ?? null,
    team: teamSet.has(address.toLowerCase()),
    profile,
    currentStreak: liveStreak(profile, TODAY),
    loggedToday: profile.lastWorkoutDay === TODAY,
    weekMinutes: weekByDay(mine).reduce((s, m) => s + m, 0),
    weekKm: week.reduce((s, w) => s + w.distanceM, 0) / 1000,
    weekCount: week.length,
  };
});

export const ranked = () => athletes.filter((a) => a.profile.totalWorkouts > 0);
export const athleteBy = (address) => athletes.find((a) => a.address.toLowerCase() === String(address).toLowerCase());

// ---- challenges -------------------------------------------------------------------------------------
const GOALS = ['distance', 'count', 'reach'];

function ruleText(mask, goalType, goalParam) {
  const acts = ACTIVITY_ORDER.filter((id) => ACTIVITIES[id].bit & mask).map((id) => ACTIVITIES[id].label);
  const what = acts.length === ACTIVITY_ORDER.length ? 'Any activity' : `${acts.join(', ')} only`;
  if (goalType === 'reach') return `${what} · reach ${goalParam} workouts`;
  return `${what} · ${goalType === 'distance' ? 'most distance' : 'most workouts'}`;
}

export const challenges = of('ChallengeCreated').map((l) => {
  const id = l.args.challengeId;
  const goalType = GOALS[l.args.goal];
  const closedLog = of('ChallengeClosed').find((x) => x.args.challengeId === id);
  const progress = of('ChallengeProgress').filter((x) => x.args.challengeId === id);

  const stat = (r) => (goalType === 'distance' ? r.distanceM : r.count);
  const standings = of('ChallengeJoined').filter((x) => x.args.challengeId === id).map((j) => {
    const mine = progress.filter((p) => p.args.user === j.args.user);
    const latest = mine[mine.length - 1];
    const lastWorkoutId = latest?.args.workoutId;
    return {
      address: j.args.user,
      joinOrder: j.args.joinOrder,
      count: latest?.args.count ?? 0,
      distanceM: latest?.args.distanceM ?? 0,
      lastDay: workouts.find((w) => w.workoutId === lastWorkoutId)?.dayId ?? null,
    };
  });
  // the same order closeChallenge settles on: the higher stat, then whoever joined first
  standings.sort((a, b) => stat(b) - stat(a) || a.joinOrder - b.joinOrder);
  standings.forEach((r, i) => { r.rank = i + 1; r.stat = stat(r); });

  const { startDay, endDay } = l.args;
  const status = closedLog ? 'closed' : startDay > TODAY ? 'upcoming' : endDay < TODAY ? 'ended' : 'open';
  const winnerAddress = closedLog?.args.winner;
  return {
    id,
    name: l.args.name,
    creator: l.args.creator,
    startDay,
    endDay,
    mask: l.args.activityMask,
    goalType,
    goalParam: l.args.goalParam,
    rule: ruleText(l.args.activityMask, goalType, l.args.goalParam),
    closed: !!closedLog,
    status,
    standings,
    participants: standings.length,
    winner: standings.find((r) => r.address === winnerAddress) ?? null,
    joined: !!account() && standings.some((r) => r.address === account()),
  };
});

export const challengeBy = (id) => challenges.find((c) => c.id === Number(id));
