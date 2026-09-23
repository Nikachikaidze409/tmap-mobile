import type { PairingService } from './pairing';
import type { RealtimeService } from './realtime';
import { ServiceError } from './errors';
import { EMPTY_DIAGNOSTICS, type RealtimeDiagnostics } from './realtimeTypes';
import { INITIAL_LOCATION_STATE, type LocationService, type LocationState } from './location';

export function createDemoLocationService(): LocationService {
  let state: LocationState = { ...INITIAL_LOCATION_STATE };
  const listeners = new Set<() => void>();
  const update = (next: LocationState) => { state = next; listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async restore() { return null; },
    async start() { update({ ...state, status: 'unavailable', message: 'Pair with a Tesla in live mode to share location.' }); },
    async stop() { update({ ...state, ...INITIAL_LOCATION_STATE }); return true; },
    async refresh() {},
    async openSettings() {},
  };
}

/** Explicit local UI demonstration. Never talks to a vehicle or backend. */
export function createDemoPairingService(): PairingService {
  return {
    async pair({ code, market, signal }) {
      if (signal.aborted) throw new Error('Cancelled');
      if (code !== 'TMAP26') throw new ServiceError('INVALID_CODE');
      return { id: 'local-demo', code, market, mode: 'demo' };
    },
    async revoke() {},
  };
}

export function createDemoRealtimeService(): RealtimeService {
  let diagnostics = { ...EMPTY_DIAGNOSTICS };
  const listeners = new Set<(state: RealtimeDiagnostics) => void>();
  const update = (patch: Partial<RealtimeDiagnostics>) => {
    diagnostics = { ...diagnostics, ...patch };
    listeners.forEach((listener) => listener(diagnostics));
  };
  return {
    async connect(session, signal) {
      if (signal.aborted) throw new Error('Cancelled');
      update({ channelState: 'SUBSCRIBED', pairingCode: session.code });
    },
    async send() { throw new ServiceError('NOT_IMPLEMENTED'); },
    subscribe() { return () => {}; },
    getDiagnostics() { return diagnostics; },
    subscribeDiagnostics(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setAppActive(active) { if (diagnostics.pairingCode) update({ channelState: active ? 'SUBSCRIBED' : 'SUSPENDED' }); },
    setDrivingActive() {},
    async disconnect() { update({ channelState: 'CLOSED', pairingCode: null }); },
  };
}
