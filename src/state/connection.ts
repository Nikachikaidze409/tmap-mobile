import type { Market } from '../types/market';
import { connectionErrorMessage } from '../services/errors';
import { isValidPairingCode, normalizePairingCode, type PairingService, type PairingSession } from '../services/pairing';
import { EMPTY_DIAGNOSTICS, type RealtimeDiagnostics, type RealtimeService, type Unsubscribe } from '../services/realtimeTypes';

type Phase =
  | { status: 'disconnected' | 'connecting' | 'error'; session: null }
  | { status: 'connected' | 'reconnecting' | 'suspended' | 'disconnecting'; session: PairingSession };
export type ConnectionState = Phase & { message: string; diagnostics: RealtimeDiagnostics };
interface Dependencies {
  pairing: PairingService;
  createRealtime: () => RealtimeService;
  timeoutMs?: number;
}
interface Attempt {
  abort: AbortController;
  session: PairingSession | null;
  realtime: RealtimeService | null;
  unsubscribe: Unsubscribe[];
  timer: ReturnType<typeof setTimeout> | null;
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new Error('Cancelled')); };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class ConnectionController {
  private state: ConnectionState = { status: 'disconnected', session: null, message: 'Ready to connect', diagnostics: { ...EMPTY_DIAGNOSTICS } };
  private readonly listeners = new Set<() => void>();
  private attempt: Attempt | null = null;
  private appActive = true;
  private cleanup: Promise<void> = Promise.resolve();
  private generation = 0;

  constructor(private readonly dependencies: Dependencies) {}
  readonly getSnapshot = (): ConnectionState => this.state;
  readonly subscribe = (listener: () => void): Unsubscribe => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private update(state: ConnectionState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  async connect(rawCode: string, market: Market): Promise<void> {
    if (this.state.status !== 'disconnected' && this.state.status !== 'error') return;
    if (!isValidPairingCode(rawCode)) {
      this.update({ ...this.state, status: 'error', session: null, message: 'Enter the 6-letter or number code shown in your Tesla.' });
      return;
    }
    const generation = ++this.generation;
    const attempt: Attempt = { abort: new AbortController(), session: null, realtime: null, unsubscribe: [], timer: null };
    this.attempt = attempt;
    let timedOut = false;
    attempt.timer = setTimeout(() => { timedOut = true; attempt.abort.abort(); }, this.dependencies.timeoutMs ?? 20_000);
    const code = normalizePairingCode(rawCode);
    this.update({ status: 'connecting', session: null, message: 'Subscribing to Tesla channel…', diagnostics: { ...EMPTY_DIAGNOSTICS, pairingCode: code, channelState: 'SUBSCRIBING' } });
    try {
      await abortable(this.cleanup, attempt.abort.signal);
      if (attempt.abort.signal.aborted || this.attempt !== attempt) return;
      const pairing = this.dependencies.pairing.pair({ code, market, signal: attempt.abort.signal });
      void pairing.then((session) => {
        if (attempt.abort.signal.aborted) void this.dependencies.pairing.revoke(session).catch(() => {});
      }, () => {});
      attempt.session = await abortable(pairing, attempt.abort.signal);
      if (attempt.abort.signal.aborted || this.attempt !== attempt) return;
      const realtime = this.dependencies.createRealtime();
      attempt.realtime = realtime;
      attempt.unsubscribe.push(realtime.subscribe((event) => {
        if (this.attempt === attempt && event.type === 'disconnect' && event.payload.by === 'tesla') {
          void this.disconnect('Disconnected by Tesla', false);
        }
      }));
      attempt.unsubscribe.push(realtime.subscribeDiagnostics((diagnostics) => this.acceptDiagnostics(attempt, diagnostics)));
      realtime.setAppActive(this.appActive);
      await abortable(realtime.connect(attempt.session, attempt.abort.signal), attempt.abort.signal);
      // SUBSCRIBED diagnostics are the sole authority for connected UI state.
      if (this.attempt === attempt) this.acceptDiagnostics(attempt, realtime.getDiagnostics());
    } catch (error) {
      if (generation === this.generation) {
        this.attempt = null;
        this.cleanup = this.release(attempt, false);
        this.update({ status: 'error', session: null, diagnostics: { ...EMPTY_DIAGNOSTICS }, message: timedOut ? 'Connection timed out. Please try again.' : connectionErrorMessage(error) });
        await this.cleanup;
      }
    } finally {
      if (attempt.timer) clearTimeout(attempt.timer);
      attempt.timer = null;
    }
  }

  private acceptDiagnostics(attempt: Attempt, diagnostics: RealtimeDiagnostics): void {
    if (this.attempt !== attempt || !attempt.session) return;
    if (this.state.diagnostics === diagnostics) return;
    if (diagnostics.channelState === 'LOST') {
      void this.disconnect('Connection lost. Enter a new pairing code.', false);
      return;
    }
    if (diagnostics.channelState === 'SUBSCRIBED') {
      this.update({ status: 'connected', session: attempt.session, diagnostics, message: attempt.session.mode === 'demo' ? 'Demo connected' : 'Realtime connected' });
      return;
    }
    if (this.state.session) {
      const suspended = diagnostics.channelState === 'SUSPENDED';
      this.update({ status: suspended ? 'suspended' : 'reconnecting', session: attempt.session, diagnostics, message: suspended ? 'Connection paused' : 'Reconnecting to Tesla channel…' });
    } else this.update({ ...this.state, diagnostics });
  }

  private async release(attempt: Attempt, notifyPeer: boolean): Promise<void> {
    attempt.unsubscribe.forEach((unsubscribe) => unsubscribe());
    attempt.unsubscribe = [];
    if (attempt.timer) clearTimeout(attempt.timer);
    attempt.timer = null;
    // Start deliberate disconnect before aborting, so abort cannot suppress its broadcast.
    const closing = attempt.realtime?.disconnect(notifyPeer).catch(() => {});
    attempt.abort.abort();
    await closing;
    if (attempt.session) await this.dependencies.pairing.revoke(attempt.session).catch(() => {});
  }

  async disconnect(message = 'Disconnected. Ready to pair again.', notifyPeer = true): Promise<void> {
    const attempt = this.attempt;
    if (!attempt) return this.cleanup;
    const generation = ++this.generation;
    this.attempt = null;
    if (notifyPeer && this.state.session) {
      this.update({ ...this.state, status: 'disconnecting', session: this.state.session, message: 'Disconnecting…', diagnostics: { ...this.state.diagnostics, channelState: 'DISCONNECTING' } });
    } else {
      this.update({ status: 'disconnected', session: null, message, diagnostics: { ...EMPTY_DIAGNOSTICS } });
    }
    this.cleanup = this.release(attempt, notifyPeer);
    await this.cleanup;
    if (generation === this.generation) this.update({ status: 'disconnected', session: null, message, diagnostics: { ...EMPTY_DIAGNOSTICS } });
  }

  setAppActive(active: boolean): void {
    this.appActive = active;
    this.attempt?.realtime?.setAppActive(active);
  }
}
