// BOT Chain mainnet settings, confirmed against https://dev-docs.botchain.ai and chainlist.org/chain/677.
// The VITE_ overrides exist so tests can point the site at a local chain.
const env = import.meta.env ?? {};

export const CHAIN_ID = Number(env.VITE_CHAIN_ID || 677);
export const CHAIN_NAME = 'BOT Chain';
export const RPC_URL = env.VITE_RPC_URL || 'https://rpc.botchain.ai';
export const EXPLORER_URL = (env.VITE_EXPLORER_URL || 'https://scan.botchain.ai').replace(/\/$/, '');
export const CONTRACT_ADDRESS = env.VITE_RUNAR_ADDRESS || '0x41782c0A753f5B2cde7c9e5bA814ABEC899489BD';
export const DEPLOY_BLOCK = BigInt(env.VITE_DEPLOY_BLOCK || 29233248);
export const DEX_URL = 'https://dex.botchain.ai/#/swap';

// Runar team wallets, marked "Team" on the leaderboard for honesty (PRD §5.3). Add addresses when they join Genesis.
export const TEAM_WALLETS = [];

export const txHref = (tx) => `${EXPLORER_URL}/tx/${tx}`;
export const addressHref = (address) => `${EXPLORER_URL}/address/${address}`;
