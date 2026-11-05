# Runar mainnet posts

Banner: `runar-mainnet-banner.png` (1600 x 900)

## Thread

```
1/6 Runar is live on BOT Chain mainnet.

A fitness record where every workout is written on-chain, and streaks and points are computed in-contract and publicly verifiable.

Contract: 0x41782c0A753f5B2cde7c9e5bA814ABEC899489BD
Chain ID: 677

App: runar-two.vercel.app
```

```
2/6 Logging. logWorkout(activity, durationSec, distanceM, note) stores the workout and emits WorkoutLogged in one transaction.

Five activity types. Notes up to 140 bytes, stored on-chain.

dayId = block.timestamp / 86400, so days roll over at 00:00 UTC.
```

```
3/6 Scoring. Streak: next day +1, same day unchanged, any gap resets to 1.

Points: activity weight x started 10-minute blocks x streak multiplier (x1.0 on day 1, +0.1 per day, capped at x2.0 from day 11).

Points are a counter with no transfer function.
```

```
4/6 Challenges. Anyone can create one with a window, an activity mask and a goal: distance, count, or reach N workouts.

After joining, qualifying logs count automatically. After the end day, anyone can call closeChallenge. Highest stat wins; ties go to the earlier joiner.
```

```
5/6 Architecture. Aggregates update incrementally at log time, so profile reads are O(1) and closing a challenge never iterates history. Per-log challenge work is bounded at 8 active joins per wallet.

No owner. No admin keys. No token. No payable functions.
```

```
6/6 Verification. Source is verified on BOTScan. In the app, "Replay from events" rebuilds an athlete's profile from WorkoutLogged logs and compares it with getProfile.

Entries are self-reported and public by design. The history is what can be checked.

scan.botchain.ai/address/0x41782c0a753f5b2cde7c9e5ba814abec899489bd
```

## Standalone posts

```
Runar.sol deployment details

Network: BOT Chain mainnet (chain ID 677)
Contract: 0x41782c0A753f5B2cde7c9e5bA814ABEC899489BD
Block: 29233248
Compiler: Solidity 0.8.24, EVM target paris

Source verified on BOTScan.

scan.botchain.ai/address/0x41782c0a753f5b2cde7c9e5ba814abec899489bd
```

```
Runar gas costs, measured on BOT Chain mainnet at 20 gwei:

First log from a new wallet: 129,535 gas (0.0026 BOT)
joinChallenge: 145,484 gas (0.0029 BOT)
setDisplayName: about 73,500 gas (0.0015 BOT)

A repeat log uses about 95,000 gas (0.0019 BOT) in our test suite.
```

```
Runar has no token and no move-to-earn emissions.

Points are a non-transferable score with no market value. Challenges are stake-free. No contract function is payable, so Runar.sol never holds funds.

The product is the record, not an asset.

runar-two.vercel.app
```

```
Genesis 7-day is open on Runar.

Challenge ID: 1
Activities: all
Goal: reach 3 workouts
Window: Nov 5 to Nov 11, 23:59 UTC

Join first: only workouts logged after joining count. Anyone can close it after the end day.

runar-two.vercel.app/app/challenge.html?id=1
```

```
Runar.sol test coverage: 18 Foundry tests, including a 512-run fuzz asserting the stored profile matches a replay of its workouts.

Covered: same-day logs, double joins, early closes, tie-breaks, empty challenges, and the UTC day boundary.

No external audit yet.
```
