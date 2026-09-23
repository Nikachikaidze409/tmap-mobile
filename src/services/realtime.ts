import { REMOTE_EVENT_NAMES, type RemoteEvent } from '../types/protocol';
import { ServiceError } from './errors';
import { pairChannelName, type PairingSession } from './pairing';
import { EMPTY_DIAGNOSTICS, type RealtimeDiagnostics, type RealtimeService } from './realtimeTypes';
import type { BroadcastConnection, BroadcastFactory } from './supabase';

export type { RealtimeService, RealtimeDiagnostics, Unsubscribe } from './realtimeTypes';
export const HEARTBEAT_INTERVAL_MS = 2_000;
export const SESSION_LOST_MS = 20_000;
export const DISCONNECT_FLUSH_MS = 500;

/** Each generation owns one channel/client; stale SDK callbacks cannot revive it. */
export class SupabaseRealtimeService implements RealtimeService {
  private diagnostics: RealtimeDiagnostics = { ...EMPTY_DIAGNOSTICS };
  private readonly listeners = new Set<(event: RemoteEvent) => void>();
  private readonly diagnosticListeners = new Set<(state: RealtimeDiagnostics) => void>();
  private connection: BroadcastConnection | null = null;
  private session: PairingSession | null = null;
  private generation = 0;
  private stopped = false;
  private appActive = true;
  private subscribed = false;
  private openedOnce = false;
  private startedAt = 0;
  private failures = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private detachAbort: (() => void) | null = null;
  private initial: Promise<void> | null = null;
  private resolveInitial: (() => void) | null = null;
  private rejectInitial: ((error: Error) => void) | null = null;
  private closing: Promise<void> | null = null;
  private pendingDisposal: Promise<void> = Promise.resolve();

  constructor(private readonly createBroadcast: BroadcastFactory) {}

  getDiagnostics = (): RealtimeDiagnostics => this.diagnostics;
  subscribe = (listener: (event: RemoteEvent) => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  subscribeDiagnostics = (listener: (state: RealtimeDiagnostics) => void) => {
    this.diagnosticListeners.add(listener);
    return () => { this.diagnosticListeners.delete(listener); };
  };
  private update(patch: Partial<RealtimeDiagnostics>): void {
    this.diagnostics = { ...this.diagnostics, ...patch };
    this.diagnosticListeners.forEach((listener) => listener(this.diagnostics));
  }

  connect(session: PairingSession, signal: AbortSignal): Promise<void> {
    if (this.initial) return this.initial;
    if (this.stopped || signal.aborted) return Promise.reject(new Error('Cancelled'));
    this.session = session;
    this.startedAt = Date.now();
    this.initial = new Promise<void>((resolve, reject) => {
      this.resolveInitial = resolve;
      this.rejectInitial = reject;
    });
    const abort = () => { void this.disconnect(); };
    signal.addEventListener('abort', abort, { once: true });
    this.detachAbort = () => signal.removeEventListener('abort', abort);
    this.update({ pairingCode: session.code });
    this.armExpiry();
    if (this.appActive) void this.open();
    else this.update({ channelState: 'SUSPENDED' });
    return this.initial;
  }

  private async open(): Promise<void> {
    if (this.stopped || !this.appActive || !this.session || this.connection) return;
    if (this.isExpired()) { this.loseSession(); return; }
    const generation = ++this.generation;
    await this.pendingDisposal;
    if (generation !== this.generation || this.stopped || !this.appActive) return;
    this.update({ channelState: 'SUBSCRIBING', reconnectCount: this.diagnostics.reconnectCount + (this.openedOnce ? 1 : 0) });
    this.openedOnce = true;
    try {
      const connection = this.createBroadcast(pairChannelName(this.session.code));
      this.connection = connection;
      connection.onBroadcast((event, payload) => {
        if (generation !== this.generation || this.stopped) return;
        this.update({ receivedMessageCount: this.diagnostics.receivedMessageCount + 1 });
        if (event === 'disconnect' && isTeslaDisconnect(payload)) {
          void this.disconnect();
          this.listeners.forEach((listener) => listener({ type: 'disconnect', payload: { by: 'tesla' } }));
        }
        // Other payloads are counted only; navigation/GPS/map remain unimplemented.
      });
      connection.subscribe((status) => {
        if (generation !== this.generation || this.stopped || !this.appActive) return;
        if (status === 'SUBSCRIBED') {
          if (this.subscribed) return;
          if (this.isExpired()) { this.loseSession(); return; }
          this.subscribed = true;
          this.failures = 0;
          this.update({ channelState: 'SUBSCRIBED' });
          if (generation !== this.generation || this.stopped) return;
          void this.sendHeartbeat(generation);
          this.heartbeat = setInterval(() => { void this.sendHeartbeat(generation); }, HEARTBEAT_INTERVAL_MS);
          this.resolveInitial?.();
          this.resolveInitial = null;
          this.rejectInitial = null;
        } else this.recover(status);
      });
    } catch (error) {
      this.rejectInitial?.(error instanceof ServiceError ? error : new Error('Connection failed'));
      void this.disconnect();
    }
  }

  private async sendHeartbeat(generation: number): Promise<void> {
    if (generation !== this.generation || !this.subscribed || !this.connection) return;
    const sentAt = Date.now();
    try {
      const status = await this.connection.send('heartbeat', { t: sentAt }, 1_500);
      if (generation !== this.generation || this.stopped) return;
      if (status !== 'ok') { this.recover('CHANNEL_ERROR'); return; }
      this.update({ lastHeartbeatSent: sentAt });
      this.armExpiry();
    } catch {
      if (generation === this.generation && !this.stopped) this.recover('CHANNEL_ERROR');
    }
  }

  private recover(status: 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'): void {
    if (this.stopped) return;
    this.releaseConnection();
    this.update({ channelState: status });
    if (this.retry || !this.appActive) return;
    const delay = Math.min(1_000 * 2 ** this.failures++, 5_000);
    this.retry = setTimeout(() => { this.retry = null; void this.open(); }, delay);
  }

  private releaseConnection(): void {
    ++this.generation;
    this.subscribed = false;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const old = this.connection;
    this.connection = null;
    if (old) this.pendingDisposal = old.dispose().catch(() => {});
  }

  private isExpired(): boolean {
    return Date.now() - (this.diagnostics.lastHeartbeatSent ?? this.startedAt) >= SESSION_LOST_MS;
  }
  private armExpiry(): void {
    if (this.expiry) clearTimeout(this.expiry);
    this.expiry = setTimeout(() => this.loseSession(), Math.max(0, SESSION_LOST_MS - (Date.now() - (this.diagnostics.lastHeartbeatSent ?? this.startedAt))));
  }
  private loseSession(): void {
    if (this.stopped) return;
    this.rejectInitial?.(new ServiceError('CONNECTION_LOST'));
    void this.disconnect();
    this.update({ channelState: 'LOST' });
  }

  setAppActive(active: boolean): void {
    if (active === this.appActive || this.stopped) return;
    this.appActive = active;
    if (!this.session) return;
    if (this.isExpired()) { this.loseSession(); return; }
    if (!active) {
      if (this.retry) clearTimeout(this.retry);
      this.retry = null;
      this.releaseConnection();
      this.update({ channelState: 'SUSPENDED' });
    } else void this.open();
  }

  async send(event: RemoteEvent): Promise<void> {
    if (!this.subscribed || !this.connection || this.stopped) throw new Error('Channel is not subscribed');
    if (!REMOTE_EVENT_NAMES.includes(event.type)) throw new Error('Unsupported event');
    const status = await this.connection.send(event.type, event.payload, 1_500);
    if (status !== 'ok') throw new Error('Broadcast was not acknowledged');
  }

  disconnect(notifyPeer = false): Promise<void> {
    if (this.closing) return this.closing;
    this.stopped = true;
    ++this.generation;
    this.detachAbort?.();
    this.detachAbort = null;
    this.rejectInitial?.(new Error('Cancelled'));
    this.resolveInitial = null;
    this.rejectInitial = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.retry) clearTimeout(this.retry);
    if (this.expiry) clearTimeout(this.expiry);
    this.heartbeat = null;
    this.retry = null;
    this.expiry = null;
    const connection = this.connection;
    const shouldNotify = notifyPeer && this.subscribed && connection;
    this.subscribed = false;
    this.session = null;
    this.update({ channelState: shouldNotify ? 'DISCONNECTING' : 'CLOSED' });
    this.closing = (async () => {
      if (shouldNotify) await flushBounded(() => connection.send('disconnect', { by: 'phone' }, DISCONNECT_FLUSH_MS));
      this.releaseConnection();
      await this.pendingDisposal;
      this.update({ channelState: this.diagnostics.channelState === 'LOST' ? 'LOST' : 'CLOSED', pairingCode: null });
    })();
    return this.closing;
  }
}

function isTeslaDisconnect(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && 'by' in payload && payload.by === 'tesla';
}

async function flushBounded(send: () => Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([send(), new Promise<void>((resolve) => { timer = setTimeout(resolve, DISCONNECT_FLUSH_MS); })]);
  } catch { /* Disconnect still completes when offline. */ }
  finally { if (timer) clearTimeout(timer); }
}
