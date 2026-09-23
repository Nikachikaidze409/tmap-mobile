import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { pairChannelName } from './pairing';
import { validateSupabaseConfiguration, type SupabaseConfiguration } from './supabase';
import type { PairedFix } from '../types/protocol';

export type SendLocationFix = (code: string, fix: PairedFix) => Promise<boolean>;
export function createLocationBroadcaster(config: SupabaseConfiguration): SendLocationFix {
  return async (code, fix) => {
    try {
      validateSupabaseConfiguration(config);
      const client = createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const channel = client.channel(pairChannelName(code), { config: { broadcast: { self: false }, private: false } });
      try {
        // Explicit REST delivery; NEVER subscribe/connect a socket here.
        const result = await channel.httpSend('fix', fix, { timeout: 4_000 });
        return result.success;
      } finally {
        // Remove first: teardown would erase the close binding that removes the
        // channel from this SDK version's registry. Cancel its idle timer too.
        try { await client.removeChannel(channel); }
        finally { channel.teardown(); await client.realtime.disconnect(); }
      }
    } catch { return false; } // Do not expose raw SDK errors or retain failed fixes.
  };
}
