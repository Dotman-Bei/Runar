// Mock wallet and contract adapter. Same calls as Runar.sol (logWorkout, joinChallenge, closeChallenge,
// setDisplayName), resolved locally so the flows can be designed and tested before deploy. Swap the bodies for
// viem/ethers calls against CONTRACT_ADDRESS once BOT Chain settings are confirmed (config.js).
import { YOU, saveLocalWorkout, LOCAL_JOINS, LOCAL_CLOSES, LOCAL_CREATED, challenges } from './data.js';

const CONNECTED = 'runar.connected';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const randomHash = () => '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
const addTo = (key, id) => { try { const s = new Set(JSON.parse(localStorage.getItem(key) || '[]')); s.add(id); localStorage.setItem(key, JSON.stringify([...s])); } catch {} };

export function isConnected() {
  try { return localStorage.getItem(CONNECTED) === '1'; } catch { return false; }
}
export function account() { return isConnected() ? YOU : null; }

export async function connect() {
  await wait(600);
  try { localStorage.setItem(CONNECTED, '1'); } catch {}
  return YOU;
}
export function disconnect() { try { localStorage.removeItem(CONNECTED); } catch {} }

// onPhase('signing' | 'confirming') lets the UI show where the transaction is.
export async function logWorkout({ activity, durationSec, distanceM, note }, onPhase = () => {}) {
  onPhase('signing');
  await wait(900);
  onPhase('confirming');
  const sent = performance.now();
  await wait(420 + Math.random() * 300);
  const w = { activity, durationSec, distanceM, note, timestamp: Math.floor(Date.now() / 1000), tx: randomHash() };
  saveLocalWorkout(w);
  return { ...w, confirmMs: Math.round(performance.now() - sent) };
}

export async function joinChallenge(id, onPhase = () => {}) {
  onPhase('signing'); await wait(800);
  onPhase('confirming'); await wait(500);
  addTo(LOCAL_JOINS, id);
  return { tx: randomHash() };
}

export async function closeChallenge(id, onPhase = () => {}) {
  onPhase('signing'); await wait(800);
  onPhase('confirming'); await wait(500);
  addTo(LOCAL_CLOSES, id);
  return { tx: randomHash() };
}

// createChallenge(name, startDay, endDay, activityMask, goalType, goalParam)
export async function createChallenge(c, onPhase = () => {}) {
  onPhase('signing'); await wait(800);
  onPhase('confirming'); await wait(500);
  const id = Math.max(...challenges.map((x) => x.id)) + 1;
  try {
    const list = JSON.parse(localStorage.getItem(LOCAL_CREATED) || '[]');
    list.push({ ...c, id });
    localStorage.setItem(LOCAL_CREATED, JSON.stringify(list));
  } catch {}
  return { id, tx: randomHash() };
}
