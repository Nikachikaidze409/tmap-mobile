import type { PairedFix } from '../types/protocol';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Never manufacture measurements: unknown accuracy makes a fix unusable. */
export function toPairedFix(value: unknown): PairedFix | null {
  if (!record(value) || !record(value.coords)) return null;
  const c = value.coords;
  if (!finite(c.latitude) || Math.abs(c.latitude) > 90 || !finite(c.longitude) || Math.abs(c.longitude) > 180 ||
      !finite(c.accuracy) || c.accuracy < 0 || !finite(value.timestamp) || value.timestamp <= 0) return null;
  return {
    lat: c.latitude, lng: c.longitude, accuracy: c.accuracy,
    heading: finite(c.heading) && c.heading >= 0 && c.heading < 360 ? c.heading : null,
    speed: finite(c.speed) && c.speed >= 0 ? c.speed : null,
    timestamp: value.timestamp,
  };
}

export const MAX_FIX_AGE_MS = 15_000;
export function newestCurrentFix(locations: unknown, now = Date.now()): PairedFix | null {
  if (!Array.isArray(locations)) return null;
  let newest: PairedFix | null = null;
  for (const location of locations) {
    const fix = toPairedFix(location);
    if (fix && now - fix.timestamp <= MAX_FIX_AGE_MS && fix.timestamp <= now + 1_000 && (!newest || fix.timestamp > newest.timestamp)) newest = fix;
  }
  return newest;
}
