import { toPairedFix, newestCurrentFix } from '../src/location/fix';
import { LocationDelivery } from '../src/background/locationHandler';
import { LocationTelemetry } from '../src/location/telemetry';
import type { DrivingSessionStore, DrivingSession } from '../src/location/sessionStore';
import type { SendLocationFix } from '../src/services/locationBroadcast';

const now = Date.now();
const sample = (timestamp = now, coords = {}) => ({ timestamp, coords: { latitude: 41, longitude: 44, accuracy: 4, heading: 25, speed: 12, ...coords } });
const saved: DrivingSession = { version: 1, code: 'ABC123', market: 'AM', startedAt: now };
function harness() {
  const store: DrivingSessionStore = { read: jest.fn(async () => saved), save: jest.fn(), clear: jest.fn() };
  const send = jest.fn<ReturnType<SendLocationFix>, Parameters<SendLocationFix>>(async () => true);
  const telemetry = new LocationTelemetry();
  return { store, send, telemetry, delivery: new LocationDelivery(store, send, telemetry) };
}
it('converts to the exact production shape', () => {
  expect(toPairedFix(sample())).toEqual({ lat: 41, lng: 44, accuracy: 4, heading: 25, speed: 12, timestamp: now });
});
it.each([null, undefined, -1, NaN, Infinity, 360, '90'])('uses null for invalid/unknown heading %s', heading => {
  expect(toPairedFix(sample(now, { heading }))?.heading).toBeNull();
});
it.each([null, undefined, -1, NaN, Infinity, '3'])('uses null for invalid/unknown speed %s', speed => {
  expect(toPairedFix(sample(now, { speed }))?.speed).toBeNull();
});
it('retains legitimate zero heading/speed', () => {
  expect(toPairedFix(sample(now, { speed: 0, heading: 0 }))).toMatchObject({ speed: 0, heading: 0 });
});
it.each([null, {}, sample(now, { latitude: 91 }), sample(now, { longitude: -181 }), sample(now, { accuracy: null }), sample(now, { accuracy: -1 }), sample(NaN)])('ignores malformed fix %#', value => {
  expect(toPairedFix(value)).toBeNull();
});
it('selects the newest current valid fix; ignores stale and future positions', () => {
  expect(newestCurrentFix([sample(now - 5), sample(now - 2), {}, sample(now - 4), sample(now + 9000)], now)?.timestamp).toBe(now - 2);
  expect(newestCurrentFix([sample(now - 16000)], now)).toBeNull();
});
it('never sends without a saved driving session', async () => {
  const h = harness(); jest.mocked(h.store.read).mockResolvedValue(null);
  await h.delivery.handle({ data: { locations: [sample()] } });
  expect(h.send).not.toHaveBeenCalled();
});
it('delivers the newest fix and updates non-coordinate telemetry only', async () => {
  const h = harness();
  await h.delivery.handle({ data: { locations: [sample(now - 2), sample()] } });
  expect(h.send).toHaveBeenCalledWith('ABC123', toPairedFix(sample()));
  expect(h.telemetry.getSnapshot()).toEqual({ timestamp: now, accuracy: 4, successfulSends: 1, delivery: 'sent' });
});
it('catches network and secure-store failures without leaking errors or throwing', async () => {
  const h = harness(); h.send.mockRejectedValueOnce(new Error('private error'));
  await expect(h.delivery.handle({ data: { locations: [sample()] } })).resolves.toBeUndefined();
  expect(h.telemetry.getSnapshot()).toMatchObject({ delivery: 'failed', successfulSends: 0 });
  jest.mocked(h.store.read).mockRejectedValueOnce(new Error('locked'));
  await expect(h.delivery.handle({ data: { locations: [sample(now + 1)] } })).resolves.toBeUndefined();
});
it('keeps only one pending newest fix during a slow request and never replays failed history', async () => {
  const h = harness();
  let finish!: (ok: boolean) => void;
  h.send.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = h.delivery.handle({ data: { locations: [sample(now - 100)] } });
  await Promise.resolve();
  const callbacks = Array.from({ length: 100 }, (_, i) => h.delivery.handle({ data: { locations: [sample(now - 99 + i)] } }));
  finish(false);
  await Promise.all([first, ...callbacks]);
  expect(h.send).toHaveBeenCalledTimes(2);
  expect(h.send.mock.calls[1]?.[1].timestamp).toBe(now);
  expect(h.telemetry.getSnapshot().successfulSends).toBe(1);
  await h.delivery.handle({ data: { locations: [sample(now - 50)] } });
  expect(h.send).toHaveBeenCalledTimes(2);
});
it('suppresses queued work on stop, including a session read racing with stop', async () => {
  const h = harness();
  let finish!: (s: DrivingSession) => void;
  jest.mocked(h.store.read).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = h.delivery.handle({ data: { locations: [sample()] } });
  h.delivery.pause(); finish(saved);
  await pending; await h.delivery.drain();
  expect(h.send).not.toHaveBeenCalled();
});
it('handles native task error or malformed data without a network request', async () => {
  const h = harness();
  await h.delivery.handle({ error: { message: 'do not log' } });
  await h.delivery.handle({ data: null });
  await h.delivery.handle({ data: { locations: 'invalid' } });
  expect(h.send).not.toHaveBeenCalled();
});
