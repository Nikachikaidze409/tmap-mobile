import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Linking, Platform } from 'react-native';
import type { LocationNative } from '../services/location';
import { BACKGROUND_LOCATION_TASK } from '../background/taskName';

export const DRIVING_LOCATION_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  activityType: Location.ActivityType.AutomotiveNavigation,
  distanceInterval: 1, timeInterval: 1_000,
  pausesUpdatesAutomatically: false, showsBackgroundLocationIndicator: true,
  deferredUpdatesDistance: 0, deferredUpdatesInterval: 0, deferredUpdatesTimeout: 0,
  foregroundService: {
    notificationTitle: 'TMap · Sharing live driving location',
    notificationBody: 'Sharing live driving location with your paired Tesla, including while this phone is locked.',
    notificationColor: '#C9F57A', killServiceOnDestroy: true,
  },
};
export const nativeLocation: LocationNative = {
  platform: Platform.OS,
  foreground: Location.getForegroundPermissionsAsync,
  background: Location.getBackgroundPermissionsAsync,
  requestForeground: Location.requestForegroundPermissionsAsync,
  requestBackground: Location.requestBackgroundPermissionsAsync,
  servicesEnabled: Location.hasServicesEnabledAsync,
  async isRunning() {
    const [started, registered] = await Promise.all([
      Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK),
      TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK),
    ]);
    return started || registered;
  },
  async start() { await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, DRIVING_LOCATION_OPTIONS); },
  async stop() { await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK); },
  openSettings: Linking.openSettings,
};
