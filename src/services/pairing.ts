import type { MarketContext } from '../types/market';
import { ServiceError } from './errors';

export interface PairingSession extends MarketContext {
  id: string;
  code: string;
  mode: 'live' | 'demo';
}

export interface PairingRequest extends MarketContext {
  code: string;
  signal: AbortSignal;
}

export interface PairingService {
  pair(request: PairingRequest): Promise<PairingSession>;
  /** Session metadata is memory-only; peer disconnect belongs to realtime. */
  revoke(session: PairingSession): Promise<void>;
}

export function normalizePairingCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidPairingCode(value: string): boolean {
  return /^[A-Z0-9]{6}$/.test(normalizePairingCode(value));
}

export function pairChannelName(code: string): string {
  if (!isValidPairingCode(code)) throw new ServiceError('INVALID_CODE');
  return `pair-${normalizePairingCode(code).toLowerCase()}`;
}

/** No invented pairing endpoint: only prepare local metadata, never claim ready. */
export function createPairingService(): PairingService {
  return {
    async pair({ code, market, signal }) {
      if (signal.aborted) throw new Error('Cancelled');
      const normalized = normalizePairingCode(code);
      return { id: pairChannelName(normalized), code: normalized, market, mode: 'live' };
    },
    async revoke() {},
  };
}
