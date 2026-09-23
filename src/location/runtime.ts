import { environment } from '../config/environment';
import { LocationDelivery } from '../background/locationHandler';
import { createLocationBroadcaster } from '../services/locationBroadcast';
import { NativeLocationService } from '../services/location';
import { drivingSessionStore } from './sessionStore';
import { LocationTelemetry } from './telemetry';
import { nativeLocation } from './native';

// Shared by the headless task and foreground UI; no React dependency.
export const locationTelemetry = new LocationTelemetry();
export const locationDelivery = new LocationDelivery(drivingSessionStore, createLocationBroadcaster({
  url: environment.supabaseUrl, publishableKey: environment.supabasePublishableKey,
}), locationTelemetry);
export const locationService = new NativeLocationService(nativeLocation, drivingSessionStore, locationDelivery, locationTelemetry);
