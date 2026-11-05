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
export const TEAM_WALLETS = [
  '0x06c5B8346CEE0430DBEaFC20D66326e76DAeb860',
  '0x73D8d7e6D0C63e5a51Ff902372A5F38428c0f34c',
  '0x9d32057d3A50B3669c8bc75043BB1C1F5335A025',
  '0x9F4FAbc56c00718174E2621470341bafA7AF666B',
  '0xc9243F447068fcF5B85a1Dd90A0dcF81a962185b',
  '0xE4BD99D0619fbCe8C148d6325850B1182bb0148b',
  '0x5d4AE5F421C596f4d4c0079Ca000f522410F94a4',
  '0x404D2190aA07497299B72A936A5876133Bfda2dC',
  '0x9A884aFA1ffDc66a54DCDd95C93ED6CAF885D40F',
  '0x8F05F609fD4A372d5Db86499E9d2b4dD8DBFDec3',
];

export const txHref = (tx) => `${EXPLORER_URL}/tx/${tx}`;
export const addressHref = (address) => `${EXPLORER_URL}/address/${address}`;
