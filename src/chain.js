// Writes to Runar.sol through the connected wallet. Every call is simulated first, so a contract rule that would fail
// is reported in words before the wallet asks for a signature.
import { BaseError, ContractFunctionRevertedError, encodeFunctionData, parseEventLogs } from 'viem';
import { ACTIVITY_ORDER } from './rules.js';
import { abi, client, runar } from './rpc.js';
import { account, ensureChain, provider } from './wallet.js';

export { account, connect, disconnect } from './wallet.js';

const REVERTS = {
  ZeroDuration: 'Duration must be more than zero.',
  DurationTooLong: 'One workout can’t be longer than 24 hours.',
  NoteTooLong: 'The note is over 140 bytes. Shorten it, especially if it has emoji or accents.',
  GymHasNoDistance: 'Gym sessions log duration only.',
  BadName: 'That name isn’t allowed.',
  NameTaken: 'That display name is taken.',
  BadWindow: 'Check the dates: the start can’t be in the past and a challenge runs for 366 days at most.',
  BadMask: 'Pick at least one activity.',
  BadGoal: 'Check the goal: reaching a number needs that number.',
  NoSuchChallenge: 'That challenge doesn’t exist.',
  AlreadyJoined: 'You’ve already joined this challenge.',
  ChallengeOver: 'This challenge has ended, so it can’t be joined.',
  ChallengeNotOver: 'This challenge can only be closed after its end day.',
  AlreadyClosed: 'This challenge is already closed.',
  TooManyActiveChallenges: 'You’re in 8 running challenges, the most allowed. A slot frees up when one ends.',
};

function explain(e) {
  if (e?.code === 4001 || e?.cause?.code === 4001) return 'Transaction rejected in your wallet. Nothing was sent.';
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    const name = revert?.data?.errorName;
    if (name && REVERTS[name]) return REVERTS[name];
    if (e.walk((x) => x.name === 'InsufficientFundsError')) return 'Not enough BOT in this wallet to pay for gas.';
    return e.shortMessage || 'The transaction failed.';
  }
  return e?.message || 'The transaction failed.';
}

async function send(functionName, args, onPhase = () => {}) {
  const from = account();
  if (!from) throw new Error('Connect a wallet first.');
  try {
    await ensureChain();
    await client.simulateContract({ ...runar, functionName, args, account: from });
    const [gas, gasPrice, balance] = await Promise.all([
      client.estimateContractGas({ ...runar, functionName, args, account: from }),
      client.getGasPrice(),
      client.getBalance({ address: from }),
    ]);
    if (balance < gas * gasPrice) throw new Error('Not enough BOT in this wallet to pay for gas.');

    onPhase('signing');
    const hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: runar.address, data: encodeFunctionData({ abi, functionName, args }) }],
    });
    onPhase('confirming');
    const sent = performance.now();
    const receipt = await client.waitForTransactionReceipt({ hash, timeout: 90_000 });
    if (receipt.status !== 'success') throw new Error('The transaction reverted on-chain.');
    return { tx: hash, confirmMs: Math.round(performance.now() - sent), events: parseEventLogs({ abi, logs: receipt.logs }) };
  } catch (e) {
    throw new Error(explain(e), { cause: e });
  }
}

export async function logWorkout({ activity, durationSec, distanceM, note }, onPhase) {
  const r = await send('logWorkout', [ACTIVITY_ORDER.indexOf(activity), durationSec, distanceM, note], onPhase);
  const ev = r.events.find((e) => e.eventName === 'WorkoutLogged').args;
  return { ...r, activity, durationSec, distanceM, note, workoutId: Number(ev.workoutId), points: Number(ev.points), streak: ev.streak };
}

export const joinChallenge = (id, onPhase) => send('joinChallenge', [BigInt(id)], onPhase);
export const closeChallenge = (id, onPhase) => send('closeChallenge', [BigInt(id)], onPhase);
export const setDisplayName = (name, onPhase) => send('setDisplayName', [name], onPhase);

const GOALS = { distance: 0, count: 1, reach: 2 };
export async function createChallenge({ name, startDay, endDay, mask, goalType, goalParam }, onPhase) {
  const r = await send('createChallenge', [name, startDay, endDay, mask, GOALS[goalType], goalParam], onPhase);
  return { ...r, id: Number(r.events.find((e) => e.eventName === 'ChallengeCreated').args.challengeId) };
}
