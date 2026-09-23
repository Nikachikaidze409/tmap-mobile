import type { MarketContext } from '../types/market';
import type { PairedFix } from '../types/protocol';
import { unavailable } from './errors';

export type LocationPermission = 'undetermined' | 'denied' | 'foreground' | 'background';

export interface LocationStartOptions extends MarketContext {
  mode: 'foreground' | 'background';
  onFix: (fix: PairedFix) => void;
  onError: (error: Error) => void;
}

export interface LocationService {
  getPermission(): Promise<LocationPermission>;
  requestPermission(scope: 'foreground' | 'background'): Promise<LocationPermission>;
  start(options: LocationStartOptions): Promise<void>;
  stop(): Promise<void>;
}

export function createLocationService(): LocationService {
  return {
    async getPermission() { return 'undetermined'; },
    async requestPermission() { return unavailable(); },
    async start() { unavailable(); },
    async stop() {},
  };
}
