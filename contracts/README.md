# Runar.sol

One contract, no dependencies. It logs workouts and keeps streaks, points and challenge standings
incrementally, so every read is O(1). There is no token, no transfer function and nothing payable: the
contract never holds funds.

## Deployment

| | |
| --- | --- |
| Network | BOT Chain mainnet (chain ID 677) |
| Contract | [`0x41782c0A753f5B2cde7c9e5bA814ABEC899489BD`](https://scan.botchain.ai/address/0x41782c0a753f5b2cde7c9e5ba814abec899489bd) (source verified) |
| Deploy transaction | [`0xbc7878…fe94`](https://scan.botchain.ai/tx/0xbc7878399f1f90eeb4af93983020d2de0393fca09633957354e7a3a76be1fe94) |
| Block | 29233248 |

## Rules (mirrored in `../src/rules.js`)

| | |
| --- | --- |
| Day | `dayId = block.timestamp / 86400`; days roll over at 00:00 UTC |
| Streak | next day +1 · same day unchanged · any gap back to 1 · best streak kept |
| Points | weight × started 10-minute blocks × multiplier |
| Weights | Swim 4 · Run 3 · Cycle 2 · Gym 2 · Walk 1 |
| Multiplier | ×1.0 on day 1, +0.1 a day, capped at ×2.0 from day 11 (integer tenths, rounded down) |
| Guards | duration 1 s – 24 h · note ≤ 140 bytes · gym logs no distance |

## Challenges

- `createChallenge(name, startDay, endDay, activityMask, goal, goalParam)`: the start can't be in the
  past, the window can be at most 366 days, and the mask is the activities' bits (Run 1, Walk 2, Gym 4,
  Cycle 8, Swim 16; 31 means all). `goal` is Distance, Count or Reach, and Reach needs `goalParam > 0`.
- `joinChallenge(id)`: allowed any time up to the end day, once per address. Only workouts logged after
  joining, inside the window and of a matching activity count. They are counted inside `logWorkout`.
- A wallet can be in at most 8 challenges that haven't ended. This bounds the per-log update, and ended
  challenges free their slot.
- The leader is updated as workouts are logged: the highest stat wins, and a tie goes to whoever joined
  first. `closeChallenge(id)` can be called by anyone after the end day. It emits
  `ChallengeClosed(id, winner, stat)`, with winner `address(0)` when nobody qualified.

## Display names

`setDisplayName(name)` takes 3–20 characters of `a–z 0–9 . _` and the name must be unique. Setting a
new name frees the old one, and an empty string clears it.

## Commands

```bash
forge test                      # 18 tests, including a 512-run fuzz of profile == replay
forge test --gas-report         # logWorkout ≈ 95k gas, joinChallenge ≈ 163k
forge script script/Deploy.s.sol                    # local simulation
forge script script/Deploy.s.sol --rpc-url https://rpc.botchain.ai --account <keystore> --gas-estimate-multiplier 105 --broadcast
RUNAR_ADDRESS=0x... forge script script/Genesis.s.sol --rpc-url https://rpc.botchain.ai --account <keystore> --broadcast
```

Before broadcasting, confirm the RPC URL, chain ID 677 and the explorer from the BOT Chain developer
docs and https://chainlist.org/chain/677. `foundry.toml` targets `paris`, which runs on any EVM version.

Deploying costs about 2.26M gas (about 0.045 BOT at 20 gwei). `script/Genesis.s.sol` opens **Genesis 7-day**
separately, for about 117k gas: it starts on the day it runs, accepts any activity and asks for 3 workouts.
Team wallets join it with `joinChallenge(1)`.

`abi/Runar.json` is the ABI for the frontend.
