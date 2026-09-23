import type { MarketContext } from '../types/market';
import { unavailable } from './errors';

export interface VoiceRequest extends MarketContext {
  locale: string;
  signal: AbortSignal;
}

export interface VoiceService {
  recognizeDestination(request: VoiceRequest): Promise<string>;
  cancel(): Promise<void>;
}

export function createVoiceService(): VoiceService {
  return {
    async recognizeDestination() { return unavailable(); },
    async cancel() {},
  };
}
