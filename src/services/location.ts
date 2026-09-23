import type { PairingSession } from './pairing';
import type { DrivingSession, DrivingSessionStore } from '../location/sessionStore';
import type { LocationDelivery } from '../background/locationHandler';
import { LocationTelemetry, type FixTelemetry } from '../location/telemetry';

export interface NativePermission {
  status: string; granted: boolean; canAskAgain: boolean;
  ios?: { accuracy?: 'full' | 'reduced'; scope?: string };
  android?: { accuracy?: 'fine' | 'coarse' | 'none' };
}
export interface LocationNative {
  platform: string;
  foreground(): Promise<NativePermission>;
  background(): Promise<NativePermission>;
  requestForeground(): Promise<NativePermission>;
  requestBackground(): Promise<NativePermission>;
  servicesEnabled(): Promise<boolean>;
  isRunning(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  openSettings(): Promise<void>;
}
export type LocationStatus = 'off' | 'requesting' | 'starting' | 'sharing' | 'denied' | 'unavailable' | 'stopping';
export interface LocationState extends FixTelemetry {
  status: LocationStatus; active: boolean; message: string;
  reducedAccuracy: boolean; needsSettings: boolean;
}
export const INITIAL_LOCATION_STATE: LocationState = {
  status: 'off', active: false, message: 'Location Off', reducedAccuracy: false, needsSettings: false,
  accuracy: null, timestamp: null, successfulSends: 0, delivery: 'idle',
};
export interface LocationService {
  getSnapshot(): LocationState;
  subscribe(listener: () => void): () => void;
  restore(): Promise<DrivingSession | null>;
  start(session: PairingSession): Promise<void>;
  stop(): Promise<boolean>;
  refresh(): Promise<void>;
  openSettings(): Promise<void>;
}
export function permissionGranted(permission: NativePermission, background = false): boolean {
  return permission.status === 'granted' && permission.granted && (!background || !permission.ios?.scope || permission.ios.scope === 'always');
}
export function isReducedAccuracy(permission: NativePermission): boolean {
  return permission.ios?.accuracy === 'reduced' || permission.android?.accuracy === 'coarse';
}

/** Owns native tracking independently of React mounts and foreground sockets. */
export class NativeLocationService implements LocationService {
  private state = { ...INITIAL_LOCATION_STATE };
  private listeners = new Set<() => void>();
  private operation: Promise<void> = Promise.resolve();
  private starting: Promise<void> | null = null;
  private stopping: Promise<boolean> | null = null;
  private restoration: Promise<DrivingSession | null> | null = null;
  private revision = 0;
  constructor(private native: LocationNative, private store: DrivingSessionStore, private delivery: LocationDelivery, private telemetry: LocationTelemetry) {
    telemetry.subscribe(() => this.update(telemetry.getSnapshot()));
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<LocationState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  openSettings = async () => {
    try { await this.native.openSettings(); }
    catch { this.update({ message: 'Open your phone’s Settings app and find TMap’s location permissions.' }); }
  };

  restore(): Promise<DrivingSession | null> {
    if (this.restoration) return this.restoration;
    const revision = this.revision;
    this.restoration = (async () => {
      try {
        const [running, session] = await Promise.all([this.native.isRunning(), this.store.read()]);
        if (revision !== this.revision) return null;
        if (running && session) {
          const [fg, bg, enabled] = await Promise.all([this.native.foreground(), this.native.background(), this.native.servicesEnabled()]);
          if (revision !== this.revision) return null;
          if (enabled && permissionGranted(fg) && permissionGranted(bg, true)) {
            this.delivery.resume();
            this.update({ active: true, status: 'sharing', message: 'Sharing Location', reducedAccuracy: isReducedAccuracy(fg) });
            return session;
          }
        }
        await this.stop(); // Stale state, revoked permissions or orphan task.
        return null;
      } catch {
        if (revision !== this.revision) return null;
        await this.stop();
        this.update({ status: 'unavailable', message: 'Could not restore location sharing. Check system location settings.', needsSettings: true });
        return null;
      }
    })().finally(() => { this.restoration = null; });
    return this.restoration;
  }

  start(session: PairingSession): Promise<void> {
    if (this.starting) return this.starting;
    if (this.state.active || this.stopping) return Promise.resolve();
    if (session.mode !== 'live') {
      this.update({ status: 'unavailable', message: 'Pair with a Tesla in live mode to share location.' });
      return Promise.resolve();
    }
    const revision = ++this.revision;
    const current = () => revision === this.revision;
    this.starting = this.operation.then(async () => {
      if (!current()) return;
      this.update({ status: 'requesting', message: 'Requesting permission…', needsSettings: false });
      try {
        if (!await this.native.servicesEnabled()) {
          if (current()) this.update({ status: 'unavailable', message: 'Location services are disabled. Enable them in system Settings.', needsSettings: true });
          return;
        }
        let fg = await this.native.foreground();
        if (!current()) return;
        if (!permissionGranted(fg) && fg.canAskAgain && fg.status !== 'restricted') fg = await this.native.requestForeground();
        if (!current()) return;
        if (!permissionGranted(fg)) { this.denied(fg, false); return; }
        this.update({ reducedAccuracy: isReducedAccuracy(fg) });
        let bg = await this.native.background();
        if (!current()) return;
        if (!permissionGranted(bg, true) && bg.canAskAgain && bg.status !== 'restricted') bg = await this.native.requestBackground();
        if (!current()) return;
        if (!permissionGranted(bg, true)) { this.denied(bg, true); return; }
        this.update({ status: 'starting', message: 'Starting…' });
        await this.store.save({ version: 1, code: session.code, market: session.market, startedAt: Date.now() });
        if (!current()) return;
        this.delivery.resume();
        if (!await this.native.isRunning()) {
          if (!current()) return;
          await this.native.start();
        }
        if (!current()) return;
        this.update({ active: true, status: 'sharing', message: 'Sharing Location' });
      } catch {
        this.delivery.pause();
        const stopped = await this.cleanupNative();
        if (current()) this.update({ status: 'unavailable', active: !stopped, message: stopped ? 'Location unavailable. Check permissions and try again.' : 'Could not stop native location. Tap Stop again or disable TMap location in Settings.', needsSettings: true });
      }
    }).finally(() => { this.starting = null; });
    this.operation = this.starting;
    return this.starting;
  }
  private denied(permission: NativePermission, background: boolean) {
    const ios = this.native.platform === 'ios' && background;
    this.update({ status: 'denied', active: false, needsSettings: !permission.canAskAgain || ios || permission.status === 'restricted', message: ios
      ? 'Background permission denied. In Settings → TMap → Location choose Always. After Allow Once, iOS may not ask again in this session.'
      : background ? 'Background permission denied. Allow location all the time in Settings to share with the screen locked.'
        : 'Location permission denied. Allow TMap location access in system Settings.' });
  }
  private async cleanupNative(): Promise<boolean> {
    let stopped = false;
    let cleared = false;
    try {
      if (await this.native.isRunning()) await this.native.stop();
      stopped = !await this.native.isRunning();
    } catch { /* Keep stop retry available; never claim tracking stopped. */ }
    try { await this.store.clear(); cleared = true; } catch { /* Fail closed in this runtime. */ }
    await this.delivery.drain();
    return stopped && cleared;
  }
  stop(): Promise<boolean> {
    if (this.stopping) return this.stopping;
    ++this.revision;
    this.delivery.pause();
    this.update({ status: 'stopping', message: 'Stopping…' });
    this.stopping = this.operation.then(async () => {
      const stopped = await this.cleanupNative();
      this.telemetry.clearLatest();
      this.update({ active: !stopped, status: stopped ? 'off' : 'unavailable', message: stopped ? 'Location Off' : 'Location cleanup failed. Tap Stop again or disable TMap location in Settings.', needsSettings: !stopped });
      return stopped;
    }).finally(() => { this.stopping = null; });
    this.operation = this.stopping.then(() => {});
    return this.stopping;
  }
  async refresh(): Promise<void> {
    if (!this.state.active || this.starting || this.stopping) return;
    const revision = this.revision;
    try {
      const [fg, bg, enabled, running] = await Promise.all([this.native.foreground(), this.native.background(), this.native.servicesEnabled(), this.native.isRunning()]);
      if (revision !== this.revision) return;
      if (!permissionGranted(fg) || !permissionGranted(bg, true) || !enabled || !running) {
        if (await this.stop()) this.update({ status: 'unavailable', message: 'Location sharing stopped. Check permissions and system location services.', needsSettings: true });
      } else this.update({ reducedAccuracy: isReducedAccuracy(fg) });
    } catch { if (revision === this.revision) this.update({ message: 'Could not check location status. Check system Settings.', needsSettings: true }); }
  }
}
