// The read client and the contract's ABI, shared by the data layer and the write adapter.
import { createPublicClient, http } from 'viem';
import abi from '../contracts/abi/Runar.json';
import { CHAIN_ID, CHAIN_NAME, CONTRACT_ADDRESS, EXPLORER_URL, RPC_URL } from './config.js';

export { abi };
export const botChain = {
  id: CHAIN_ID,
  name: CHAIN_NAME,
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: 'BOTScan', url: EXPLORER_URL } },
};
export const client = createPublicClient({ chain: botChain, transport: http(RPC_URL, { timeout: 10_000, retryCount: 1 }) });
export const runar = { address: CONTRACT_ADDRESS, abi };

export async function readProfile(address) {
  const [totalWorkouts, streak, bestStreak, points, lastWorkoutDay] = await client.readContract({ ...runar, functionName: 'getProfile', args: [address] });
  return { totalWorkouts, streak, bestStreak, points: Number(points), lastWorkoutDay };
}
