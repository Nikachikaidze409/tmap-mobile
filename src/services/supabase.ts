import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { ServiceError } from './errors';
import type { RemoteEventName } from '../types/protocol';

export type SubscriptionStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
export interface BroadcastConnection {
  onBroadcast(listener: (event: string, payload: unknown) => void): void;
  subscribe(listener: (status: SubscriptionStatus) => void): void;
  send(event: RemoteEventName, payload: unknown, timeoutMs: number): Promise<string>;
  dispose(): Promise<void>;
}
export type BroadcastFactory = (channelName: string) => BroadcastConnection;
export interface SupabaseConfiguration { url: string; publishableKey: string }

/** Accept only modern public keys; never accept service-role JWTs or secret keys. */
export function validateSupabaseConfiguration(config: SupabaseConfiguration): void {
  if (!config.url || !config.publishableKey) throw new ServiceError('NOT_CONFIGURED');
  try {
    const url = new URL(config.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error();
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey)) throw new Error();
  } catch { throw new ServiceError('INVALID_CONFIG'); }
}

/** Thin Supabase adapter. No new socket, endpoint, envelope, or authentication flow. */
export function createSupabaseBroadcastFactory(config: SupabaseConfiguration): BroadcastFactory {
  return (name) => {
    validateSupabaseConfiguration(config);
    // Each transport owns its socket so removing a failed channel also stops all
    // SDK reconnect/auth timers for that generation. Sessions stay in memory.
    const client = createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { timeout: 5_000 },
    });
    const channel = client.channel(name, { config: { broadcast: { ack: true, self: false }, private: false } });
    let disposed = false;
    return {
      onBroadcast(listener) {
        channel.on('broadcast', { event: '*' }, ({ event, payload }) => listener(event, payload));
      },
      subscribe(listener) { channel.subscribe(listener); },
      async send(event, payload, timeoutMs) {
        // Prevent Supabase's automatic HTTP fallback when a socket is offline.
        if (disposed || channel.state !== 'joined' || !client.realtime.isConnected()) return 'error';
        return channel.send({ type: 'broadcast', event, payload }, { timeout: timeoutMs });
      },
      async dispose() {
        if (disposed) return;
        disposed = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const removal = client.removeChannel(channel);
          const closing = client.realtime.disconnect();
          await Promise.race([
            Promise.allSettled([removal, closing]),
            new Promise<void>((resolve) => { timer = setTimeout(resolve, 500); }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
          // Also clear the channel's rejoin/push timers if leave acknowledgement
          // was impossible. teardown is a public realtime-js lifecycle method.
          channel.teardown();
        }
      },
    };
  };
}
