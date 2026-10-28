// Chain settings. Confirm every value from BOT Chain Builder Docs and https://chainlist.org/chain/677
// before deploy (PRD §11–12); never hardcode the RPC from memory. Set them in .env:
//   VITE_EXPLORER_URL=https://<explorer from the official docs>
//   VITE_RUNAR_ADDRESS=0x<deployed Runar.sol>
export const CHAIN_ID = 677;
export const CHAIN_NAME = 'BOT Chain';
export const EXPLORER_URL = import.meta.env?.VITE_EXPLORER_URL || '';
export const CONTRACT_ADDRESS = import.meta.env?.VITE_RUNAR_ADDRESS || '';

// Without a configured explorer, a tx link opens the workout on its athlete record instead.
export function txHref(tx, user, workoutId) {
  if (EXPLORER_URL) return `${EXPLORER_URL.replace(/\/$/, '')}/tx/${tx}`;
  return `/app/athlete.html?a=${user}#w${workoutId}`;
}
