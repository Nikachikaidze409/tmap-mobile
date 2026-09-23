import { ConnectionController } from '../src/state/connection';
import { createDemoPairingService, createDemoRealtimeService } from '../src/services/demo';
import type { PairingService, PairingSession } from '../src/services/pairing';
import type { RealtimeService } from '../src/services/realtime';
import type { RemoteEvent } from '../src/types/protocol';
import { EMPTY_DIAGNOSTICS, type RealtimeDiagnostics } from '../src/services/realtimeTypes';

const session: PairingSession = { id: 'test-session', code: 'ABC123', market: 'AM', mode: 'live' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function harness(pairOverride?: PairingService['pair']) {
  let receive: ((event: RemoteEvent) => void) | undefined;
  let receiveDiagnostics: ((state: RealtimeDiagnostics) => void) | undefined;
  let diagnostics = { ...EMPTY_DIAGNOSTICS };
  const publish = (patch: Partial<RealtimeDiagnostics>) => {
    diagnostics = { ...diagnostics, ...patch };
    receiveDiagnostics?.(diagnostics);
  };
  const unsubscribe = jest.fn();
  const realtime: RealtimeService = {
    connect: jest.fn(async () => { publish({ channelState: 'SUBSCRIBED', pairingCode: 'ABC123' }); }), send: jest.fn(async () => {}),
    subscribe: jest.fn((listener) => { receive = listener; return unsubscribe; }),
    disconnect: jest.fn(async () => {}),
    getDiagnostics: () => diagnostics,
    subscribeDiagnostics: jest.fn((listener) => { receiveDiagnostics = listener; return () => { receiveDiagnostics = undefined; }; }),
    setAppActive: jest.fn(),
  };
  const pairing: PairingService = { pair: jest.fn(pairOverride ?? (async () => session)), revoke: jest.fn(async () => {}) };
  const controller = new ConnectionController({ pairing, createRealtime: () => realtime, timeoutMs: 100 });
  return { controller, pairing, realtime, unsubscribe, publish, emit: (event: RemoteEvent) => receive?.(event) };
}

afterEach(() => { jest.useRealTimers(); });

it.each(['GE', 'AM'] as const)('pairs a local demo for %s and disconnects', async (market) => {
  const controller = new ConnectionController({ pairing: createDemoPairingService(), createRealtime: createDemoRealtimeService });
  await controller.connect(' tmap26 ', market);
  expect(controller.getSnapshot()).toMatchObject({ status: 'connected', session: { market, mode: 'demo' } });
  await controller.disconnect();
  expect(controller.getSnapshot()).toMatchObject({ status: 'disconnected', session: null });
});

it('rejects invalid input before invoking the adapter', async () => {
  const { controller, pairing } = harness();
  await controller.connect('12', 'AM');
  expect(pairing.pair).not.toHaveBeenCalled();
  expect(controller.getSnapshot().status).toBe('error');
});

it('supports retry after a rejected demo code', async () => {
  const controller = new ConnectionController({ pairing: createDemoPairingService(), createRealtime: createDemoRealtimeService });
  await controller.connect('ABC123', 'GE');
  expect(controller.getSnapshot().status).toBe('error');
  await controller.connect('TMAP26', 'AM');
  expect(controller.getSnapshot().status).toBe('connected');
  await controller.disconnect();
});

it('normalizes codes, passes market, and suppresses duplicate submissions', async () => {
  const pending = deferred<PairingSession>();
  const { controller, pairing } = harness(() => pending.promise);
  const first = controller.connect('abc123', 'AM');
  await controller.connect('ABC123', 'GE');
  await settle();
  expect(pairing.pair).toHaveBeenCalledTimes(1);
  expect(pairing.pair).toHaveBeenCalledWith(expect.objectContaining({ code: 'ABC123', market: 'AM' }));
  expect(controller.getSnapshot().status).toBe('connecting');
  pending.resolve(session);
  await first;
  await controller.disconnect();
});

it('does not expose arbitrary backend error messages', async () => {
  const { controller } = harness(async () => { throw new Error('secret-token=do-not-display'); });
  await controller.connect('ABC123', 'AM');
  expect(controller.getSnapshot()).toMatchObject({ status: 'error', message: 'Could not connect to Tesla. Please try again.' });
});

it('revokes pairing and closes realtime when channel setup fails', async () => {
  const { controller, pairing, realtime, unsubscribe } = harness();
  jest.mocked(realtime.connect).mockRejectedValueOnce(new Error('network'));
  await controller.connect('ABC123', 'AM');
  expect(controller.getSnapshot().status).toBe('error');
  expect(pairing.revoke).toHaveBeenCalledWith(session);
  expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('times out and revokes a pairing response that arrives late', async () => {
  jest.useFakeTimers();
  const pending = deferred<PairingSession>();
  const { controller, pairing } = harness(() => pending.promise);
  const result = controller.connect('ABC123', 'AM');
  await jest.advanceTimersByTimeAsync(101);
  await result;
  expect(controller.getSnapshot()).toMatchObject({ status: 'error', message: 'Connection timed out. Please try again.' });
  pending.resolve(session);
  await Promise.resolve();
  expect(pairing.revoke).toHaveBeenCalledWith(session);
  expect(controller.getSnapshot().status).toBe('error');
});

it('ignores stale pairing results after cancellation and reconnect', async () => {
  const pending = deferred<PairingSession>();
  const { controller, pairing } = harness(() => pending.promise);
  const oldAttempt = controller.connect('ABC123', 'GE');
  await settle();
  await controller.disconnect();
  jest.mocked(pairing.pair).mockResolvedValueOnce({ ...session, id: 'new' });
  await controller.connect('ABC123', 'AM');
  pending.resolve({ ...session, id: 'old' });
  await oldAttempt;
  expect(controller.getSnapshot()).toMatchObject({ status: 'connected', session: { id: 'new' } });
  expect(pairing.revoke).toHaveBeenCalledWith(expect.objectContaining({ id: 'old' }));
  await controller.disconnect();
});

it('handles remote disconnect and releases resources only once', async () => {
  const { controller, pairing, realtime, unsubscribe, emit } = harness();
  await controller.connect('ABC123', 'AM');
  emit({ type: 'heartbeat', payload: { t: Date.now() } });
  expect(controller.getSnapshot().status).toBe('connected');
  emit({ type: 'disconnect', payload: { by: 'tesla' } });
  expect(controller.getSnapshot().message).toBe('Disconnected by Tesla');
  await controller.disconnect();
  expect(controller.getSnapshot()).toMatchObject({ status: 'disconnected', session: null });
  expect(realtime.disconnect).toHaveBeenCalledTimes(1);
  expect(pairing.revoke).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it('clears local state even if remote cleanup rejects', async () => {
  const { controller, pairing, realtime } = harness();
  await controller.connect('ABC123', 'AM');
  jest.mocked(pairing.revoke).mockRejectedValueOnce(new Error('offline'));
  jest.mocked(realtime.disconnect).mockRejectedValueOnce(new Error('offline'));
  await controller.disconnect();
  await Promise.resolve();
  expect(controller.getSnapshot().status).toBe('disconnected');
});

it('publishes state transitions and allows subscriptions to be removed', async () => {
  const { controller } = harness();
  const listener = jest.fn();
  const unsubscribe = controller.subscribe(listener);
  await controller.connect('ABC123', 'AM');
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  await controller.disconnect();
  expect(listener).toHaveBeenCalledTimes(2);
});

it('shows reconnecting on channel loss and only restores ready from SUBSCRIBED', async () => {
  const { controller, publish } = harness();
  await controller.connect('ABC123', 'AM');
  publish({ channelState: 'CHANNEL_ERROR' });
  expect(controller.getSnapshot()).toMatchObject({ status: 'reconnecting', session, message: 'Reconnecting to Tesla channel…' });
  publish({ channelState: 'SUBSCRIBING' });
  expect(controller.getSnapshot().status).toBe('reconnecting');
  publish({ channelState: 'SUBSCRIBED' });
  expect(controller.getSnapshot().status).toBe('connected');
  publish({ channelState: 'LOST' });
  expect(controller.getSnapshot()).toMatchObject({ status: 'disconnected', session: null, message: 'Connection lost. Enter a new pairing code.' });
  await controller.disconnect();
});

it('cannot claim ready merely because an adapter promise resolves', async () => {
  const { controller, realtime } = harness();
  jest.mocked(realtime.connect).mockResolvedValueOnce(undefined);
  await controller.connect('ABC123', 'AM');
  expect(controller.getSnapshot()).toMatchObject({ status: 'connecting', session: null });
  await controller.disconnect();
});
