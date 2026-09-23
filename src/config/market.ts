import type { Market } from '../types/market';

export const MARKETS: Readonly<Record<Market, { name: string; locale: string }>> = {
  GE: { name: 'Georgia', locale: 'ka-GE' },
  AM: { name: 'Armenia', locale: 'hy-AM' },
};

// Product default belongs here, never in a reusable service or protocol payload.
export const DEFAULT_MARKET: Market = 'GE';

export function isMarket(value: unknown): value is Market {
  return value === 'GE' || value === 'AM';
}

export function parseDefaultMarket(value: string | undefined): Market {
  if (value === undefined || value === '') return DEFAULT_MARKET;
  if (!isMarket(value)) throw new Error('EXPO_PUBLIC_DEFAULT_MARKET must be GE or AM.');
  return value;
}
