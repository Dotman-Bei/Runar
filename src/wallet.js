// The injected wallet (MetaMask, BO Wallet and the like). Holds who is connected; imports nothing from the data
// layer, so the data layer can include a connected wallet that has not logged anything yet.
import { getAddress } from 'viem';
import { CHAIN_ID, CHAIN_NAME, EXPLORER_URL, RPC_URL } from './config.js';

const CONNECTED = 'runar.connected';
const HEX_CHAIN = `0x${CHAIN_ID.toString(16)}`;

export const provider = typeof window !== 'undefined' ? window.ethereum ?? null : null;

const remembered = () => { try { return localStorage.getItem(CONNECTED) === '1'; } catch { return false; } };
const remember = (on) => { try { if (on) localStorage.setItem(CONNECTED, '1'); else localStorage.removeItem(CONNECTED); } catch { /* storage blocked */ } };

async function silentAccount() {
  if (!provider || !remembered()) return null;
  try {
    const accounts = await Promise.race([
      provider.request({ method: 'eth_accounts' }),
      new Promise((resolve) => setTimeout(() => resolve([]), 2500)),
    ]);
    return accounts[0] ? getAddress(accounts[0]) : null;
  } catch { return null; }
}

let current = await silentAccount();
export const account = () => current;

if (provider?.on) {
  provider.on('accountsChanged', () => location.reload());
  provider.on('chainChanged', () => location.reload());
}

export async function ensureChain() {
  if (await provider.request({ method: 'eth_chainId' }) === HEX_CHAIN) return;
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: HEX_CHAIN }] });
  } catch (e) {
    if (e.code !== 4902) throw e; // 4902: the wallet does not know this chain yet
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId: HEX_CHAIN, chainName: CHAIN_NAME, nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 }, rpcUrls: [RPC_URL], blockExplorerUrls: [EXPLORER_URL] }],
    });
  }
}

export async function connect() {
  if (!provider) throw new Error('No wallet found. Install a browser wallet such as MetaMask, or open Runar in your wallet app’s browser.');
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    await ensureChain();
    current = getAddress(accounts[0]);
    remember(true);
    return current;
  } catch (e) {
    if (e.code === 4001) throw new Error('Connection cancelled in your wallet.');
    throw e;
  }
}

export function disconnect() {
  remember(false);
  current = null;
}
