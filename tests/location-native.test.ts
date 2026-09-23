import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { drivingSessionStore, parseDrivingSession, SECURE_OPTIONS, DRIVING_SESSION_KEY } from '../src/location/sessionStore';
import { nativeLocation, DRIVING_LOCATION_OPTIONS } from '../src/location/native';
import { BACKGROUND_LOCATION_TASK } from '../src/background/taskName';
import appConfig from '../app.config';
import type { ConfigContext } from 'expo/config';

it.each(['GE', 'AM'] as const)('reads and normalizes a secure %s session', market => {
  expect(parseDrivingSession(JSON.stringify({ version: 1, code: 'abc123', market, startedAt: 123 }))).toEqual({ version: 1, code: 'ABC123', market, startedAt: 123 });
});
it.each([null, 'bad json', '{}', '{"version":2}', JSON.stringify({ version: 1, code: 'ABC123', market: 'US', startedAt: 123 }), JSON.stringify({ version: 1, code: 'bad', market: 'GE', startedAt: 123 })])('ignores invalid saved state %#', raw => expect(parseDrivingSession(raw)).toBeNull());
it('writes only minimal session fields and permits access after first unlock', async () => {
  const session = { version: 1 as const, code: 'ABC123', market: 'GE' as const, startedAt: 123 };
  await drivingSessionStore.save({ ...session, unnecessaryField: 'must not persist' } as typeof session);
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(DRIVING_SESSION_KEY, JSON.stringify(session), SECURE_OPTIONS);
  expect(SECURE_OPTIONS).toEqual({ requireAuthentication: false, keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  await drivingSessionStore.clear();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(DRIVING_SESSION_KEY, SECURE_OPTIONS);
});
it('reads secure state with the same options', async () => {
  await drivingSessionStore.read();
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(DRIVING_SESSION_KEY, SECURE_OPTIONS);
});
it('registers the existing task at module scope without starting location', () => {
  jest.isolateModules(() => { jest.requireActual('../src/background/registerTasks'); });
  expect(TaskManager.defineTask).toHaveBeenCalledWith('tmap.background-location.v1', expect.any(Function));
  expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
});
it('does not define a duplicate task during module reload', () => {
  jest.mocked(TaskManager.isTaskDefined).mockReturnValueOnce(true);
  jest.isolateModules(() => { jest.requireActual('../src/background/registerTasks'); });
  expect(TaskManager.defineTask).not.toHaveBeenCalled();
});
it('checks native registration and applies automotive settings via native APIs', async () => {
  await nativeLocation.isRunning();
  expect(TaskManager.isTaskRegisteredAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  expect(Location.hasStartedLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
  await nativeLocation.start();
  expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK, expect.objectContaining({
    accuracy: Location.Accuracy.BestForNavigation, activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 1, timeInterval: 1000, pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true, deferredUpdatesDistance: 0, deferredUpdatesInterval: 0,
  }));
  expect(DRIVING_LOCATION_OPTIONS.foregroundService?.notificationBody).toContain('paired Tesla');
  await nativeLocation.stop();
  expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
});
it('configures all background capabilities through Expo plugins', () => {
  const config = appConfig({ config: { name: 'TMap', slug: 'tmap-mobile' } } as ConfigContext);
  expect(config.plugins).toContainEqual(['expo-location', expect.objectContaining({
    locationWhenInUsePermission: expect.stringContaining('Tesla'),
    locationAlwaysAndWhenInUsePermission: expect.stringContaining('locked'),
    isIosBackgroundLocationEnabled: true, isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true,
  })]);
  expect(config.plugins).toContainEqual(['expo-secure-store', expect.any(Object)]);
});
