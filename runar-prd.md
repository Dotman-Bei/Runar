# PRD — Runar
**A SocialFi fitness-tracking project on BOT Chain**
Version 1.0 · 2026-10-28 · Status: approved for build
Ecosystem category: Social (https://www.botchain.ai/en/project-party/)

---

## 1. Overview

**Runar** is a SocialFi fitness tracker where every workout is logged on-chain. Users record activities (run, walk, gym, cycle, swim), build publicly verifiable streaks and points, compete on leaderboards, and join group challenges — all anchored permanently on BOT Chain. The blockchain part is load-bearing: your fitness history can't be deleted, reset, or lost when an app shuts down.

**One-sentence pitch:** *Your fitness record is yours, forever — logged on-chain, scored in public.*

## 2. Problem

Fitness data is the most disposable data people generate. Apps close (Nike Run Club sunset its app; countless trackers have died), accounts get banned, streaks vanish into product decisions. And fitness is inherently social — leaderboards and challenges drive adherence — yet every platform locks your progress inside its own garden. Runar makes the record permanent and the competition open: anyone can verify a streak, any community can run a challenge, and the data outlives the app.

## 3. Goals & Non-Goals

**Goals (v1)**
- Users log workouts on-chain in one transaction (type, duration, distance, optional note).
- On-chain streaks and points per user, computed in-contract, publicly verifiable.
- Public leaderboards (all-time, this week) read live from chain.
- Group challenges: anyone can create, anyone can join, rankings computed on-chain at close.
- Mobile-friendly PWA so logging works from the gym.

**Non-goals (v1)**
- No token, no move-to-earn rewards — points are a non-transferable score, not an asset.
- No NFTs in v1 (achievement badges considered at M3 only).
- No escrow: challenges are stake-free honor competitions; no funds ever held by the contract.
- No hardware/wearable integration (Apple Health, Google Fit, Strava) — v1 is self-reported logging.
- No health-data privacy claims: everything posted is public by design. Users log what they want to be seen.
- No anti-cheat guarantees: entries are self-attested; honesty is enforced socially (public history), not cryptographically.

## 4. Users & User Stories

| Actor | Story |
|---|---|
| Casual user | "I logged my 5k run and my streak hit 14 days — the tx is on the explorer, nobody can fake it." |
| Competitor | "I joined the 30-day challenge and I'm 3rd on the leaderboard — my workouts are all publicly checkable." |
| Community leader | "I created a team challenge for our DAO; at close the contract computed the winner from on-chain logs." |
| Skeptic / evaluator | "I picked a random user and replayed their workouts from events — the record matches what the UI shows." |

## 5. Product Requirements

### 5.1 Smart contract — `Runar.sol` (Solidity, one contract, ~200 lines)
- `logWorkout(activityType, durationSec, distanceM, note)` → stores the workout, assigns `workoutId`, emits `WorkoutLogged(user, workoutId, activityType, durationSec, distanceM, dayId, timestamp)`. `dayId = timestamp / 86400`.
- Streak logic (incremental, no loops): if `dayId == lastWorkoutDay + 1` → `streak += 1`; if `dayId == lastWorkoutDay` → same-day second workout (allowed, streak unchanged); else `streak = 1`. Updates `bestStreak`.
- Points (non-transferable `uint256` counter, emitted in events for indexers): base points = activity-type weight × duration buckets; streak multiplier capped at 2x. Purely a leaderboard score — no ERC-20, no transfer function, no value.
- `createChallenge(name, startDay, endDay, activityMask, goalType, goalParam)` → creates a challenge (e.g., "most distance in 14 days, runs only"). Creator pays only gas. Emits `ChallengeCreated`.
- `joinChallenge(challengeId)` → registers participant; entries logged during the window with matching activity auto-count toward the challenge (flag checked inside `logWorkout`, no separate logging step).
- `closeChallenge(challengeId)` → callable by anyone after `endDay`; contract computes winner deterministically from stored aggregates (distance or workout count per participant, updated incrementally at log time — no iteration over history). Emits `ChallengeClosed(challengeId, winner, stat)`.
- `getProfile(user)` → total workouts, current streak, best streak, points, last workout day.
- `getChallenge(challengeId)` → config, participant count, aggregates view.
- Guards: `require(durationSec > 0)`, capped note length (140 chars, stored on-chain — near-zero fees make this viable), one challenge-join per address, challenge creator can't close early, no unbounded loops anywhere.
- Access control: none for logging — one wallet = one identity; only the logging wallet can log its own workouts (implicit via msg.sender).

### 5.2 Frontend (PWA, wallet-connected)
- **Log tab:** activity picker, duration/distance inputs, note field, one-tx submit → sub-second confirm → streak/points animation. Optimistic UI, confirmed by finality.
- **Dashboard:** streak counter (with flame), points, this-week totals, workout history list, perma-links to explorer txs.
- **Leaderboard:** tabs for points / current streak / this-week volume; addresses shown with optional self-set display name (stored on-chain in `setDisplayName`, one per address).
- **Challenges:** browse open challenges, join with one tx, live standings during window, winner banner after close.
- **PWA basics:** add-to-homescreen, works offline for browsing cached data, queue-then-submit not required for v1 (sub-second finality makes live submit fine).

### 5.3 Demo & launch assets
- Genesis challenge at deploy ("Genesis 7-day: log 3+ workouts") with team wallets participating so standings look alive on day one.
- README: pitch, architecture, contract addresses, run instructions.
- 2–4 min demo video: log a run → streak increments → join challenge → show leaderboard → verify a workout on the explorer.

## 6. Technical Architecture

```
User (PWA + wallet)                    BOT Chain
┌──────────────────────────┐ logWorkout ┌──────────────────────────┐
│ activity, duration → sign│ ─────────► │ Runar                │
│ → broadcast              │            │  workouts (events)       │
│                          │ join/close │  streaks, points         │
│ dashboard reads via      │ ─────────► │  challenges, standings   │
│ events + view calls ◄────│            │                          │
└──────────────────────────┘            └──────────┬───────────────┘
        ▲                                          │ events (index)
        └──────────────── PWA frontend ◄───────────┘
```

- Chain economics exploited deliberately: per-workout anchoring costs fractions of a cent — a 365-workout year costs less than one coffee. That's the pitch line: *"log every workout, forever, for almost nothing."*
- All aggregates (points, streaks, challenge standings) are maintained incrementally in-contract, so reads are O(1) and closing a challenge never iterates history.

## 7. Key Flows

1. **First log** → connect wallet → set optional display name → log workout → profile created implicitly (streak = 1, points credited).
2. **Daily streak** → log on consecutive day → contract increments streak, emits event → frontend flame animation.
3. **Challenge lifecycle** → creator deploys challenge → users join (anytime before close) → qualifying logs count automatically → after `endDay`, anyone calls `closeChallenge` → winner and final standings emitted and rendered.
4. **Verification** → any workout links to its explorer tx; leaderboard entries replayable from events.

Edge cases: logging twice same day (allowed, streak unchanged); joining a challenge twice reverts; logging for a challenge after `endDay` counts toward profile but not standings; `closeChallenge` before `endDay` reverts; zero-participant challenge closes with winner = address(0), no crash.

## 8. Success Metrics

| Metric | v1 target |
|---|---|
| Contract deployed & verified on mainnet | Day 1 |
| Workouts logged in month one | ≥ 300 |
| Unique athlete wallets month one | ≥ 50 |
| Challenges created by users (not team) | ≥ 5 |
| Week-4 retention of month-one users | ≥ 25% |
| Demo video + submission complete | Week 1–2 |
| Ecosystem directory listing live (botchain.ai/en/project-party/) | On acceptance |

## 9. Roadmap (mapped to BOT Labs phased funding)

- **M1 — Deployed MVP:** contract + PWA live, log/streak/points/leaderboard working, genesis challenge run to completion, demo video done. *(unlocks: capital + tooling support)*
- **M2 — Community:** user-created challenges active, display names, social share cards (image of your streak with tx hash), bug/docs feedback contributions to the BOT Chain ecosystem, partner challenges with Telegram/Discord fitness groups. *(unlocks: traffic via official wallet / DApp portal, gas rebates)*
- **M3 — Depth:** achievement badges as on-chain attestations (no ERC-721 sale — permanent logged milestones), Strava/Health import as *signed* off-chain proofs anchored by hash, API/subgraph for third-party fitness communities, localized UI. *(unlocks: listing green channel, ecosystem certification)*

## 10. Scope Guardrails

- **No move-to-earn token.** STEPN-style reward economies collapse on emission schedules; points stay non-transferable by design. If a token is ever proposed, it must be justified by a sink/faucet model in a separate review.
- **No escrow anywhere.** Challenges are stake-free; the contract never holds value.
- **No hardware integration in v1.** Self-reported logging is honest enough for SocialFi; hardware proofs are an M3 problem.
- **No reply threads/social feed.** Leaderboards and challenges carry the social signal; a feed is a moderation burden v1 doesn't need.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Chain config drift (RPC, chain ID) | Fetch from official docs (botchain.ai → Builder Docs) and https://chainlist.org/chain/677 at build time; CI re-check against chainlist |
| Self-reported data dishonesty | Accept openly: public history + social verification is the enforcement; pitch frames Runar as commitment device, not anti-cheat oracle |
| Move-to-earn comparison / token pressure | §10 guardrail; points are explicitly non-transferable and valueless |
| Cold-start empty leaderboards | Team wallets + genesis challenge guarantee live standings day one |
| Privacy expectations (health data) | Product copy is explicit: everything posted is public; users choose what to log; nothing medical is solicited |
| Scope creep into full social app | §10 guardrails enforced in review |

## 12. Dependencies

- BOT Chain mainnet access: RPC, explorer, faucet from official docs (botchain.ai → Builder Docs) — verify before first deploy; never hardcode RPC from memory.
- Standard EVM tooling (Foundry or Hardatch), a wallet, static/PWA frontend hosting.
- Ecosystem submission: "Submit a Project" flow at botchain.ai/en/project-party/ for Social category listing.
