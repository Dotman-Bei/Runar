export const shortAddr = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`;
export const shortHash = (h) => `${h.slice(0, 6)}…${h.slice(-4)}`;
export const nameOf = (a) => a.name || shortAddr(a.address);

export function duration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
export const minutes = (sec) => Math.round(sec / 60);
export const km = (m, digits = 2) => (m / 1000).toFixed(digits);
export const int = (n) => Number(n).toLocaleString('en-US');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function dayDate(dayId) {
  const d = new Date(dayId * 86400000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export const weekday = (dayId) => DAYS[new Date(dayId * 86400000).getUTCDay()];
export function relDay(dayId, today) {
  const diff = today - dayId;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return dayDate(dayId);
}
export function timeOfDay(ts) {
  const d = new Date(ts * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const ordinal = (n) => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };
