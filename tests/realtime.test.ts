import { SupabaseRealtimeService, DISCONNECT_FLUSH_MS } from '../src/services/realtime';
import type { BroadcastConnection, SubscriptionStatus } from '../src/services/supabase';
import type { PairingSession } from '../src/services/pairing';
import type { RemoteEventName } from '../src/types/protocol';

const session: PairingSession = { id: 'pair-abc123', code: 'ABC123', market: 'AM', mode: 'live' };
const services: SupabaseRealtimeService[] = [];

class FakeChannel implements BroadcastConnection {
  status: (status: SubscriptionStatus) => void = () => {};
  message: (event: string, payload: unknown) => void = () => {};
  onBroadcast = jest.fn((listener: typeof this.message) => { this.message = listener; });
  subscribe = jest.fn((listener: typeof this.status) => { this.status = listener; });
  send = jest.fn(async (_event: RemoteEventName, _payload: unknown, _timeout: number) => 'ok');
  dispose = jest.fn(async () => {});
}

function harness() {
  const channels: FakeChannel[] = [];
  const factory = jest.fn(() => { const channel = new FakeChannel(); channels.push(channel); return channel; });
  const service = new SupabaseRealtimeService(factory);
  services.push(service);
  const abort = new AbortController();
  return { service, factory, channels, abort };
}
async function subscribe(h = harness()) {
  const ready = h.service.connect(session, h.abort.signal);
  await Promise.resolve();
  h.channels[0]!.status('SUBSCRIBED');
  await ready;
  return h;
}

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-23T12:00:00Z')); });
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.disconnect()));
  expect(jest.getTimerCount()).toBe(0);
  jest.useRealTimers();
});

it('subscribes to the exact channel and sends nothing until SUBSCRIBED', async () => {
  const h = harness();
  let ready = false;
  const pending = h.service.connect(session, h.abort.signal).then(() => { ready = true; });
  await Promise.resolve();
  expect(h.factory).toHaveBeenCalledWith('pair-abc123');
  expect(h.channels[0]!.send).not.toHaveBeenCalled();
  expect(ready).toBe(false);
  h.channels[0]!.status('SUBSCRIBED');
  await pending;
  expect(ready).toBe(true);
  expect(h.channels[0]!.send).toHaveBeenCalledWith('heartbeat', { t: Date.now() }, 1500);
  expect(h.service.getDiagnostics()).toMatchObject({ pairingCode: 'ABC123', channelState: 'SUBSCRIBED', lastHeartbeatSent: Date.now() });
});

it('sends immediately and every 2000 ms without duplicate subscriptions/timers', async () => {
  const h = await subscribe();
  const channel = h.channels[0]!;
  h.service.connect(session, h.abort.signal);
  channel.status('SUBSCRIBED');
  channel.status('SUBSCRIBED');
  await jest.advanceTimersByTimeAsync(1999);
  expect(channel.send).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(channel.send).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(2000);
  expect(channel.send).toHaveBeenCalledTimes(3);
  expect(channel.subscribe).toHaveBeenCalledTimes(1);
  expect(h.factory).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(2); // One heartbeat and one loss deadline.
});

it.each(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'] as const)('recovers %s with one replacement and ignores obsolete callbacks', async (status) => {
  const h = await subscribe();
  const old = h.channels[0]!;
  old.status(status);
  old.status('CLOSED');
  old.status('SUBSCRIBED');
  expect(h.service.getDiagnostics().channelState).toBe(status);
  expect(old.dispose).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1000);
  expect(h.factory).toHaveBeenCalledTimes(2);
  const replacement = h.channels[1]!;
  expect(replacement.send).not.toHaveBeenCalled();
  replacement.status('SUBSCRIBED');
  await jest.advanceTimersByTimeAsync(4000);
  expect(replacement.send).toHaveBeenCalledTimes(3);
  expect(old.send).toHaveBeenCalledTimes(1);
  expect(h.service.getDiagnostics()).toMatchObject({ channelState: 'SUBSCRIBED', reconnectCount: 1 });
});

it('waits for old channel disposal before creating a replacement', async () => {
  const h = await subscribe();
  let finish!: () => void;
  h.channels[0]!.dispose.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
  h.channels[0]!.status('CHANNEL_ERROR');
  await jest.advanceTimersByTimeAsync(1000);
  expect(h.factory).toHaveBeenCalledTimes(1);
  finish();
  await jest.advanceTimersByTimeAsync(0);
  expect(h.factory).toHaveBeenCalledTimes(2);
  h.channels[1]!.status('SUBSCRIBED');
});

it('can recover a failed first subscription without reporting ready early', async () => {
  const h = harness();
  let ready = false;
  const pending = h.service.connect(session, h.abort.signal).then(() => { ready = true; });
  await Promise.resolve();
  h.channels[0]!.status('TIMED_OUT');
  await jest.advanceTimersByTimeAsync(1000);
  expect(ready).toBe(false);
  h.channels[1]!.status('SUBSCRIBED');
  await pending;
  expect(ready).toBe(true);
});

it('stops immediately for Tesla disconnect without echoing a phone disconnect', async () => {
  const h = await subscribe();
  const receive = jest.fn();
  h.service.subscribe(receive);
  h.channels[0]!.message('disconnect', { by: 'tesla' });
  await h.service.disconnect();
  expect(receive).toHaveBeenCalledWith({ type: 'disconnect', payload: { by: 'tesla' } });
  expect(h.service.getDiagnostics()).toMatchObject({ pairingCode: null, receivedMessageCount: 1, channelState: 'CLOSED' });
  await jest.advanceTimersByTimeAsync(10000);
  expect(h.channels[0]!.send).toHaveBeenCalledTimes(1);
  expect(h.channels[0]!.dispose).toHaveBeenCalledTimes(1);
});

it('counts messages but ignores invalid disconnect payloads and phone echoes', async () => {
  const h = await subscribe();
  for (const payload of [null, {}, { by: 'phone' }, { by: 'other' }]) h.channels[0]!.message('disconnect', payload);
  h.channels[0]!.message('nav', { arbitrary: 'counted, not consumed' });
  expect(h.service.getDiagnostics()).toMatchObject({ channelState: 'SUBSCRIBED', receivedMessageCount: 5 });
});

it('flushes the exact phone disconnect broadcast and disposes once', async () => {
  const h = await subscribe();
  const channel = h.channels[0]!;
  let finish!: (status: string) => void;
  channel.send.mockReturnValueOnce(new Promise<string>((resolve) => { finish = resolve; }));
  const closing = h.service.disconnect(true);
  expect(h.service.disconnect(true)).toBe(closing);
  expect(channel.send).toHaveBeenLastCalledWith('disconnect', { by: 'phone' }, 500);
  expect(channel.dispose).not.toHaveBeenCalled();
  finish('ok');
  await closing;
  expect(channel.dispose).toHaveBeenCalledTimes(1);
  expect(h.service.getDiagnostics().pairingCode).toBeNull();
});

it('bounds disconnect flush if the network never acknowledges', async () => {
  const h = await subscribe();
  h.channels[0]!.send.mockReturnValueOnce(new Promise(() => {}));
  const closing = h.service.disconnect(true);
  await jest.advanceTimersByTimeAsync(DISCONNECT_FLUSH_MS);
  await closing;
  expect(h.channels[0]!.dispose).toHaveBeenCalledTimes(1);
});

it('stops timers in background and resubscribes once on a short foreground return', async () => {
  const h = await subscribe();
  h.service.setAppActive(false);
  h.service.setAppActive(false);
  expect(h.service.getDiagnostics().channelState).toBe('SUSPENDED');
  await jest.advanceTimersByTimeAsync(4000);
  expect(h.channels[0]!.send).toHaveBeenCalledTimes(1);
  h.service.setAppActive(true);
  h.service.setAppActive(true);
  await jest.advanceTimersByTimeAsync(0);
  expect(h.factory).toHaveBeenCalledTimes(2);
  h.channels[1]!.status('SUBSCRIBED');
  expect(h.channels[1]!.send).toHaveBeenCalledTimes(1);
});

it('does not revive a session after Tesla’s 20-second loss window', async () => {
  const h = await subscribe();
  const diagnostics = jest.fn();
  h.service.subscribeDiagnostics(diagnostics);
  h.service.setAppActive(false);
  // Simulate JS suspension: the foreground check must work without timer callbacks.
  jest.setSystemTime(Date.now() + 21000);
  h.service.setAppActive(true);
  await h.service.disconnect();
  expect(diagnostics).toHaveBeenCalledWith(expect.objectContaining({ channelState: 'LOST' }));
  expect(h.factory).toHaveBeenCalledTimes(1);
});

it('reconnects on a failed heartbeat without counting it as sent', async () => {
  const h = await subscribe();
  const lastSent = h.service.getDiagnostics().lastHeartbeatSent;
  h.channels[0]!.send.mockResolvedValueOnce('timed out');
  await jest.advanceTimersByTimeAsync(2000);
  expect(h.service.getDiagnostics()).toMatchObject({ channelState: 'CHANNEL_ERROR', lastHeartbeatSent: lastSent });
  await jest.advanceTimersByTimeAsync(1000);
  expect(h.factory).toHaveBeenCalledTimes(2);
});

it('cancels pending subscription, disposes resources and ignores a late SUBSCRIBED', async () => {
  const h = harness();
  const pending = h.service.connect(session, h.abort.signal);
  const rejected = expect(pending).rejects.toThrow('Cancelled');
  await Promise.resolve();
  h.abort.abort();
  h.channels[0]!.status('SUBSCRIBED');
  await rejected;
  await h.service.disconnect();
  expect(h.channels[0]!.send).not.toHaveBeenCalled();
  expect(h.channels[0]!.dispose).toHaveBeenCalledTimes(1);
});

it('clears scheduled reconnection on unmount/disconnect', async () => {
  const h = await subscribe();
  h.channels[0]!.status('CHANNEL_ERROR');
  await h.service.disconnect();
  await jest.advanceTimersByTimeAsync(10000);
  expect(h.factory).toHaveBeenCalledTimes(1);
});
