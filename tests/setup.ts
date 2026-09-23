jest.mock('react-native-safe-area-context', () =>
  jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 }, ActivityType: { AutomotiveNavigation: 1 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
  getBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true, canAskAgain: true })),
  hasServicesEnabledAsync: jest.fn(async () => true),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(async () => {}), stopLocationUpdatesAsync: jest.fn(async () => {}),
}));
jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false), defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
}));
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => {}), deleteItemAsync: jest.fn(async () => {}),
}));
