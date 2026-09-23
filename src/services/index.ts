import { createDemoPairingService, createDemoRealtimeService } from './demo';
import { createLocationService } from './location';
import { createNavigationService } from './navigation';
import { createPairingService } from './pairing';
import { SupabaseRealtimeService } from './realtime';
import { createSupabaseBroadcastFactory, type SupabaseConfiguration } from './supabase';
import { createRemoteMapService } from './remoteMap';
import { createVoiceService } from './voice';

export function createServices(demoMode: boolean, supabase: SupabaseConfiguration = { url: '', publishableKey: '' }) {
  return {
    pairing: demoMode ? createDemoPairingService() : createPairingService(),
    createRealtime: demoMode ? createDemoRealtimeService : () => new SupabaseRealtimeService(createSupabaseBroadcastFactory(supabase)),
    location: createLocationService(),
    voice: createVoiceService(),
    navigation: createNavigationService(),
    remoteMap: createRemoteMapService(),
  };
}

export type Services = ReturnType<typeof createServices>;
