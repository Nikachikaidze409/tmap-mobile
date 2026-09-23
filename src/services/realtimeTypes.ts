import type { RemoteEvent } from '../types/protocol';
import type { PairingSession } from './pairing';

export type Unsubscribe = () => void;
export type ChannelState = 'IDLE' | 'SUBSCRIBING' | 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'SUSPENDED' | 'DISCONNECTING' | 'LOST';
export interface RealtimeDiagnostics {
  pairingCode: string | null;
  channelState: ChannelState;
  lastHeartbeatSent: number | null;
  receivedMessageCount: number;
  reconnectCount: number;
}
export const EMPTY_DIAGNOSTICS: RealtimeDiagnostics = {
  pairingCode: null, channelState: 'IDLE', lastHeartbeatSent: null,
  receivedMessageCount: 0, reconnectCount: 0,
};

export interface RealtimeService {
  /** Resolves only after the first SUBSCRIBED callback, not local validation. */
  connect(session: PairingSession, signal: AbortSignal): Promise<void>;
  send(event: RemoteEvent): Promise<void>;
  subscribe(listener: (event: RemoteEvent) => void): Unsubscribe;
  getDiagnostics(): RealtimeDiagnostics;
  subscribeDiagnostics(listener: (diagnostics: RealtimeDiagnostics) => void): Unsubscribe;
  setAppActive(active: boolean): void;
  setDrivingActive(active: boolean): void;
  /** notifyPeer is only for a deliberate phone disconnect. */
  disconnect(notifyPeer?: boolean): Promise<void>;
}
