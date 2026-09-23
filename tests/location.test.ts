import { NativeLocationService, isReducedAccuracy, permissionGranted, type LocationNative, type NativePermission } from '../src/services/location';
import { LocationDelivery } from '../src/background/locationHandler';
import { LocationTelemetry } from '../src/location/telemetry';
import type { DrivingSession, DrivingSessionStore } from '../src/location/sessionStore';
import type { PairingSession } from '../src/services/pairing';

const granted: NativePermission = { status: 'granted', granted: true, canAskAgain: true };
const denied: NativePermission = { status: 'denied', granted: false, canAskAgain: true };
const session: PairingSession = { id: 'pair-abc123', code: 'ABC123', market: 'GE', mode: 'live' };
const saved: DrivingSession = { version: 1, code: session.code, market: session.market, startedAt: Date.now() };

function harness() {
  let running = false;
  let stored: DrivingSession | null = null;
  const native = {
    platform: 'ios', foreground: jest.fn(async () => granted), background: jest.fn(async () => granted),
    requestForeground: jest.fn(async () => granted), requestBackground: jest.fn(async () => granted),
    servicesEnabled: jest.fn(async (): Promise<boolean> => true), isRunning: jest.fn(async () => running),
    start: jest.fn(async () => { running = true; }), stop: jest.fn(async () => { running = false; }),
    openSettings: jest.fn(async () => {}),
  } satisfies LocationNative;
  const store = {
    read: jest.fn(async () => stored), save: jest.fn(async (s: DrivingSession) => { stored = s; }), clear: jest.fn(async () => { stored = null; }),
  } satisfies DrivingSessionStore;
  const telemetry = new LocationTelemetry();
  const send = jest.fn(async () => true);
  const delivery = new LocationDelivery(store, send, telemetry);
  const service = new NativeLocationService(native, store, delivery, telemetry);
  return { native, store, telemetry, service, delivery, send, setRunning: (value: boolean) => { running = value; }, setStored: (value: DrivingSession | null) => { stored = value; } };
}

it.each(['undetermined', 'denied', 'restricted'])('maps %s to not granted', (status) => {
  expect(permissionGranted({ ...denied, status })).toBe(false);
});
it('requires Always when an iOS background scope is available', () => {
  expect(permissionGranted({ ...granted, ios: { scope: 'whenInUse' } }, true)).toBe(false);
  expect(permissionGranted({ ...granted, ios: { scope: 'always' } }, true)).toBe(true);
});
it.each([
  [{ ...granted, ios: { accuracy: 'reduced' } }, true],
  [{ ...granted, ios: { accuracy: 'full' } }, false],
  [{ ...granted, android: { accuracy: 'coarse' } }, true],
  [{ ...granted, android: { accuracy: 'fine' } }, false],
] as const)('maps accuracy access %#', (permission, expected) => expect(isReducedAccuracy(permission)).toBe(expected));

it('requests foreground first and never asks background after foreground denial', async () => {
  const h = harness();
  h.native.foreground.mockResolvedValue(denied);
  h.native.requestForeground.mockResolvedValue(denied);
  await h.service.start(session);
  expect(h.native.requestForeground).toHaveBeenCalledTimes(1);
  expect(h.native.background).not.toHaveBeenCalled();
  expect(h.service.getSnapshot()).toMatchObject({ status: 'denied', active: false });
  expect(h.native.start).not.toHaveBeenCalled();
  expect(h.store.save).not.toHaveBeenCalled();
});
it('never requests again when permission cannot be asked; exposes Settings', async () => {
  const h = harness();
  h.native.foreground.mockResolvedValue({ ...denied, canAskAgain: false });
  await h.service.start(session);
  expect(h.native.requestForeground).not.toHaveBeenCalled();
  expect(h.service.getSnapshot().needsSettings).toBe(true);
  await h.service.openSettings();
  expect(h.native.openSettings).toHaveBeenCalledTimes(1);
});
it('explains the iOS Allow Once / Always limitation and never starts after background denial', async () => {
  const h = harness();
  h.native.background.mockResolvedValue(denied);
  h.native.requestBackground.mockResolvedValue(denied);
  await h.service.start(session);
  expect(h.service.getSnapshot()).toMatchObject({ status: 'denied', active: false, needsSettings: true, message: expect.stringContaining('Always') });
  expect(h.service.getSnapshot().message).toContain('Allow Once');
  expect(h.native.start).not.toHaveBeenCalled();
});
it('requests both permissions in order and shows reduced accuracy when granted', async () => {
  const h = harness();
  h.native.foreground.mockResolvedValue(denied);
  h.native.background.mockResolvedValue(denied);
  h.native.requestForeground.mockResolvedValue({ ...granted, ios: { accuracy: 'reduced' } });
  await h.service.start(session);
  expect(h.native.requestForeground.mock.invocationCallOrder[0]!).toBeLessThan(h.native.requestBackground.mock.invocationCallOrder[0]!);
  expect(h.service.getSnapshot()).toMatchObject({ active: true, reducedAccuracy: true });
  await h.service.stop();
});
it('handles disabled system services without requesting permissions', async () => {
  const h = harness(); h.native.servicesEnabled.mockResolvedValue(false);
  await h.service.start(session);
  expect(h.service.getSnapshot()).toMatchObject({ status: 'unavailable', active: false, needsSettings: true });
  expect(h.native.foreground).not.toHaveBeenCalled();
});
it.each(['GE', 'AM'] as const)('persists only the minimal session and starts once for %s', async market => {
  const h = harness();
  const first = h.service.start({ ...session, market });
  expect(h.service.start({ ...session, market })).toBe(first);
  await first;
  await h.service.start({ ...session, market });
  expect(h.native.start).toHaveBeenCalledTimes(1);
  expect(h.store.save).toHaveBeenCalledWith({ version: 1, code: 'ABC123', market, startedAt: expect.any(Number) });
  expect(h.service.getSnapshot()).toMatchObject({ active: true, status: 'sharing' });
  await h.service.stop();
  expect(h.native.stop).toHaveBeenCalledTimes(1);
  expect(h.store.clear).toHaveBeenCalledTimes(1);
  expect(h.service.getSnapshot()).toMatchObject({ active: false, status: 'off' });
});
it('cleans persisted state after native startup fails', async () => {
  const h = harness(); h.native.start.mockRejectedValue(new Error('raw platform detail'));
  await h.service.start(session);
  expect(h.store.clear).toHaveBeenCalled();
  expect(h.service.getSnapshot()).toMatchObject({ active: false, status: 'unavailable' });
  expect(h.service.getSnapshot().message).not.toContain('raw platform');
});
it('cancels permission/start work before native tracking can be activated', async () => {
  const h = harness();
  let finish!: (permission: NativePermission) => void;
  h.native.foreground.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const starting = h.service.start(session);
  for (let i = 0; i < 5; i++) await Promise.resolve();
  const stopping = h.service.stop();
  finish(granted);
  await Promise.all([starting, stopping]);
  expect(h.native.start).not.toHaveBeenCalled();
  expect(h.store.save).not.toHaveBeenCalled();
  expect(h.service.getSnapshot().active).toBe(false);
});
it('reports stop failures, inhibits delivery and offers a retry', async () => {
  const h = harness(); await h.service.start(session);
  h.native.stop.mockRejectedValueOnce(new Error('native failure'));
  expect(await h.service.stop()).toBe(false);
  expect(h.store.clear).toHaveBeenCalled();
  expect(h.service.getSnapshot()).toMatchObject({ active: true, status: 'unavailable', needsSettings: true });
  expect(await h.service.stop()).toBe(true);
});
it('restores a valid active task without requesting permission or starting again', async () => {
  const h = harness(); h.setRunning(true); h.setStored(saved);
  expect(await h.service.restore()).toEqual(saved);
  expect(h.native.start).not.toHaveBeenCalled();
  expect(h.native.requestForeground).not.toHaveBeenCalled();
  expect(h.service.getSnapshot().active).toBe(true);
  // UI remount reconciles again instead of returning an obsolete cached result.
  expect(await h.service.restore()).toEqual(saved);
  await h.service.stop();
});
it('clears a stale saved session without silently starting tracking', async () => {
  const h = harness(); h.setStored(saved);
  expect(await h.service.restore()).toBeNull();
  expect(h.store.clear).toHaveBeenCalled();
  expect(h.native.start).not.toHaveBeenCalled();
});
it('stops an orphan task with no saved session', async () => {
  const h = harness(); h.setRunning(true);
  expect(await h.service.restore()).toBeNull();
  expect(h.native.stop).toHaveBeenCalledTimes(1);
});
it('stops on foreground reconciliation after permission revocation', async () => {
  const h = harness(); await h.service.start(session);
  h.native.background.mockResolvedValue(denied);
  await h.service.refresh();
  expect(h.service.getSnapshot()).toMatchObject({ active: false, status: 'unavailable', needsSettings: true });
  expect(h.native.stop).toHaveBeenCalledTimes(1);
  expect(h.store.clear).toHaveBeenCalled();
});

it('does not restore a stale in-flight read after Stop', async () => {
  const h = harness(); h.setRunning(true);
  let finish!: (value: DrivingSession) => void;
  h.store.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const restoring = h.service.restore();
  await h.service.stop(); finish(saved);
  expect(await restoring).toBeNull();
  expect(h.service.getSnapshot().active).toBe(false);
});
it('does not re-request restricted permission', async () => {
  const h = harness(); h.native.foreground.mockResolvedValue({ ...denied, status: 'restricted' });
  await h.service.start(session);
  expect(h.native.requestForeground).not.toHaveBeenCalled();
  expect(h.service.getSnapshot()).toMatchObject({ status: 'denied', needsSettings: true });
});
