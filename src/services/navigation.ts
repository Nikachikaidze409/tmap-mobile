import type { MarketContext } from '../types/market';
import type { PairedNavState } from '../types/protocol';
import type { Unsubscribe } from './realtime';
import { unavailable } from './errors';

export type Destination = NonNullable<PairedNavState['destination']>;

/** Requests go to the existing navigation engine. No routes are computed here. */
export interface NavigationService {
  search(query: string, context: MarketContext, signal: AbortSignal): Promise<Destination[]>;
  requestDestination(destination: Destination, context: MarketContext): Promise<void>;
  clear(): Promise<void>;
  subscribe(listener: (state: PairedNavState) => void): Unsubscribe;
}

export function createNavigationService(): NavigationService {
  return {
    async search() { return unavailable(); },
    async requestDestination() { unavailable(); },
    async clear() { unavailable(); },
    subscribe() { return () => {}; },
  };
}
