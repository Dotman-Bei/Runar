// Mirrors the scoring and streak rules of Runar.sol (PRD §5.1).
// Weights and the multiplier ladder are the v1 proposal from docs/FRONTEND.md §3.0 and must match the
// deployed contract before launch.

export const ACTIVITIES = {
  run:   { id: 'run',   label: 'Run',   weight: 3, bit: 1,  hasDistance: true },
  walk:  { id: 'walk',  label: 'Walk',  weight: 1, bit: 2,  hasDistance: true },
  gym:   { id: 'gym',   label: 'Gym',   weight: 2, bit: 4,  hasDistance: false },
  cycle: { id: 'cycle', label: 'Cycle', weight: 2, bit: 8,  hasDistance: true },
  swim:  { id: 'swim',  label: 'Swim',  weight: 4, bit: 16, hasDistance: true },
};
export const ACTIVITY_ORDER = ['run', 'walk', 'gym', 'cycle', 'swim'];

export const NOTE_MAX = 140;
export const BUCKET_SEC = 600;

export const dayIdOf = (ts) => Math.floor(ts / 86400);
export const buckets = (durationSec) => Math.ceil(durationSec / BUCKET_SEC);

// multiplier in tenths, so integer maths matches the contract: 10 = ×1.0, 20 = ×2.0
export const multiplierTenths = (streak) => Math.min(10 + (streak - 1), 20);

export function basePoints(activity, durationSec) {
  return ACTIVITIES[activity].weight * buckets(durationSec);
}

export function pointsFor(activity, durationSec, streak) {
  return Math.floor((basePoints(activity, durationSec) * multiplierTenths(streak)) / 10);
}

// The incremental streak step from logWorkout: no loops, only the last workout day.
export function nextStreak(profile, dayId) {
  if (profile.totalWorkouts === 0) return { streak: 1, rule: 'first' };
  if (dayId === profile.lastWorkoutDay) return { streak: profile.streak, rule: 'same-day' };
  if (dayId === profile.lastWorkoutDay + 1) return { streak: profile.streak + 1, rule: 'next-day' };
  return { streak: 1, rule: 'gap', gap: dayId - profile.lastWorkoutDay - 1 };
}

export const emptyProfile = () => ({ totalWorkouts: 0, streak: 0, bestStreak: 0, points: 0, lastWorkoutDay: null });

// Apply one workout to a profile, returning the points it earned and the rule that fired.
export function applyWorkout(profile, w) {
  const dayId = dayIdOf(w.timestamp);
  const step = nextStreak(profile, dayId);
  const pts = pointsFor(w.activity, w.durationSec, step.streak);
  profile.totalWorkouts += 1;
  profile.streak = step.streak;
  profile.bestStreak = Math.max(profile.bestStreak, step.streak);
  profile.points += pts;
  profile.lastWorkoutDay = dayId;
  return { pts, step, dayId };
}

// Replays a list of WorkoutLogged events into a profile, as the skeptic would.
export function replay(workouts) {
  const p = emptyProfile();
  [...workouts].sort((a, b) => a.timestamp - b.timestamp).forEach((w) => applyWorkout(p, w));
  return p;
}

// A streak is only "current" while the last workout was today or yesterday.
export function liveStreak(profile, todayDay) {
  if (profile.lastWorkoutDay == null) return 0;
  return todayDay - profile.lastWorkoutDay <= 1 ? profile.streak : 0;
}
