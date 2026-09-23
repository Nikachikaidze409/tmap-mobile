import type { MarketContext } from '../types/market';
import type { PairedView } from '../types/protocol';
import { unavailable } from './errors';

export interface RemoteMapService {
  setView(view: PairedView, context: MarketContext): Promise<void>;
}

export function createRemoteMapService(): RemoteMapService {
  return { async setView() { unavailable(); } };
}
