import { ConnectionController } from '../src/state/connection';
import { createPairingService } from '../src/services/pairing';
import { SupabaseRealtimeService } from '../src/services/realtime';
import { INITIAL_LOCATION_STATE, type LocationService, type LocationState } from '../src/services/location';
import type { BroadcastConnection, SubscriptionStatus } from '../src/services/supabase';
import type { DrivingSession } from '../src/location/sessionStore';

class Channel implements BroadcastConnection {
  status: (status: SubscriptionStatus) => void = () => {};
  message: (event: string, payload: unknown) => void = () => {};
  onBroadcast = (listener: typeof this.message) => { this.message = listener; };
  subscribe = jest.fn((listener: typeof this.status) => { this.status = listener; });
  send = jest.fn(async () => 'ok');
  dispose = jest.fn(async () => {});
}
function harness(restored: DrivingSession | null = null) {
  let state: LocationState = { ...INITIAL_LOCATION_STATE };
  const listeners = new Set<() => void>();
  const update = (active: boolean) => { state = { ...state, active, status: active ? 'sharing' : 'off' }; listeners.forEach(fn => fn()); };
  const location = {
    getSnapshot: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    restore: jest.fn(async () => { if (restored) update(true); return restored; }),
    start: jest.fn(async () => { update(true); }),
    stop: jest.fn(async (): Promise<boolean> => { update(false); return true; }), refresh: jest.fn(async () => {}), openSettings: jest.fn(async () => {}),
  } satisfies LocationService;
  const channels: Channel[] = [];
  const factory = jest.fn(() => { const c = new Channel(); channels.push(c); return c; });
  const controller = new ConnectionController({ pairing: createPairingService(), createRealtime: () => new SupabaseRealtimeService(factory), location, restoreDriving: true });
  return { controller, location, channels, factory };
}
async function ticks() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
async function connect(h: ReturnType<typeof harness>) {
  const ready = h.controller.connect('ABC123', 'AM');
  await ticks(); h.channels[0]!.status('SUBSCRIBED'); await ready;
  await h.controller.startLocation();
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('keeps driving across a long background interval and creates one replacement on resume', async () => {
  const h = harness(); await connect(h);
  h.controller.setAppActive(false);
  await jest.advanceTimersByTimeAsync(60_000);
  expect(h.controller.getSnapshot()).toMatchObject({ status: 'suspended', session: { code: 'ABC123' } });
  expect(h.location.stop).not.toHaveBeenCalled();
  expect(h.channels[0]!.send).toHaveBeenCalledTimes(1);
  h.controller.setAppActive(true); h.controller.setAppActive(true);
  await ticks();
  expect(h.channels).toHaveLength(2);
  h.channels[1]!.status('SUBSCRIBED'); h.channels[1]!.status('SUBSCRIBED');
  await jest.advanceTimersByTimeAsync(4000);
  expect(h.channels[1]!.send).toHaveBeenCalledTimes(3);
  expect(h.location.start).toHaveBeenCalledTimes(1);
  await h.controller.disconnect(); h.controller.detach(); await ticks();
  expect(jest.getTimerCount()).toBe(0);
});
it('stops location before the phone disconnect broadcast and clears the UI session', async () => {
  const h = harness(); await connect(h);
  let finish!: (stopped: boolean) => void;
  h.location.stop.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const closing = h.controller.disconnect();
  expect(h.channels[0]!.send).toHaveBeenCalledTimes(1);
  finish(true); await closing;
  expect(h.channels[0]!.send).toHaveBeenLastCalledWith('disconnect', { by: 'phone' }, 500);
  expect(h.controller.getSnapshot().session).toBeNull();
  h.controller.detach(); await ticks();
});
it('stops native tracking after a received Tesla disconnect without echo', async () => {
  const h = harness(); await connect(h);
  h.channels[0]!.message('disconnect', { by: 'tesla' });
  await ticks();
  expect(h.location.stop).toHaveBeenCalledTimes(1);
  expect(h.controller.getSnapshot()).toMatchObject({ session: null, message: 'Disconnected by Tesla' });
  expect(h.channels[0]!.send).toHaveBeenCalledTimes(1);
  h.controller.detach(); await ticks();
});
it('retains a visible retry path if native stop fails', async () => {
  const h = harness(); await connect(h);
  h.location.stop.mockResolvedValueOnce(false);
  await h.controller.disconnect();
  expect(h.controller.getSnapshot().session).not.toBeNull();
  expect(h.channels[0]!.send).toHaveBeenCalledTimes(1);
  await h.controller.disconnect(); h.controller.detach(); await ticks();
});
it('restores only an already active native driving session and waits for SUBSCRIBED', async () => {
  const h = harness({ version: 1, code: 'ABC123', market: 'GE', startedAt: Date.now() - 60000 });
  await h.controller.initialize(); await ticks();
  expect(h.controller.getSnapshot()).toMatchObject({ status: 'reconnecting', session: { market: 'GE' } });
  await jest.advanceTimersByTimeAsync(30_000);
  expect(h.controller.getSnapshot().session).not.toBeNull();
  h.channels[0]!.status('SUBSCRIBED'); await ticks();
  expect(h.controller.getSnapshot().status).toBe('connected');
  expect(h.location.start).not.toHaveBeenCalled();
  await h.controller.disconnect(); h.controller.detach(); await ticks();
});
it('detaches the UI socket without ending native driving', async () => {
  const h = harness(); await connect(h);
  h.controller.detach(); await ticks();
  expect(h.location.stop).not.toHaveBeenCalled();
  expect(h.channels[0]!.dispose).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
it('returns to the Step 2 loss deadline when sharing stops in background', async () => {
  const h = harness(); await connect(h);
  h.controller.setAppActive(false);
  await jest.advanceTimersByTimeAsync(30000);
  await h.controller.stopLocation();
  await jest.advanceTimersByTimeAsync(20001);
  expect(h.controller.getSnapshot().session).toBeNull();
  h.controller.detach(); await ticks();
});
it('does not stop an existing native drive or reconnect after unmount during startup reconciliation', async () => {
  const h = harness();
  let finish!: (session: DrivingSession) => void;
  h.location.restore.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const restoring = h.controller.initialize();
  h.controller.detach();
  finish({ version: 1, code: 'ABC123', market: 'GE', startedAt: Date.now() });
  await restoring; await ticks();
  expect(h.location.stop).not.toHaveBeenCalled();
  expect(h.factory).not.toHaveBeenCalled();
});
