export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function formatMoney(value) {
  return `$${Math.floor(value).toLocaleString('en-US')}`;
}
