import * as SecureStore from 'expo-secure-store';
import type { Market } from '../types/market';
import { isValidPairingCode, normalizePairingCode } from '../services/pairing';

export interface DrivingSession { version: 1; code: string; market: Market; startedAt: number }
export interface DrivingSessionStore {
  read(): Promise<DrivingSession | null>;
  save(session: DrivingSession): Promise<void>;
  clear(): Promise<void>;
}
export const DRIVING_SESSION_KEY = 'tmap.active-driving.v1';
export const SECURE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};

export function parseDrivingSession(raw: string | null): DrivingSession | null {
  if (!raw) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!s || typeof s !== 'object' || !('version' in s) || s.version !== 1 || !('code' in s) ||
        typeof s.code !== 'string' || !isValidPairingCode(s.code) || !('market' in s) ||
        (s.market !== 'GE' && s.market !== 'AM') || !('startedAt' in s) || typeof s.startedAt !== 'number' ||
        !Number.isFinite(s.startedAt) || s.startedAt <= 0 || s.startedAt > Date.now() + 1_000) return null;
    return { version: 1, code: normalizePairingCode(s.code), market: s.market, startedAt: s.startedAt };
  } catch { return null; }
}

export const drivingSessionStore: DrivingSessionStore = {
  async read() { return parseDrivingSession(await SecureStore.getItemAsync(DRIVING_SESSION_KEY, SECURE_OPTIONS)); },
  async save(session) {
    // Explicit projection prevents accidental credential/location persistence.
    const { version, code, market, startedAt } = session;
    await SecureStore.setItemAsync(DRIVING_SESSION_KEY, JSON.stringify({ version, code, market, startedAt }), SECURE_OPTIONS);
  },
  async clear() { await SecureStore.deleteItemAsync(DRIVING_SESSION_KEY, SECURE_OPTIONS); },
};
