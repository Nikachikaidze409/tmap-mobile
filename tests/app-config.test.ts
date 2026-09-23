import type { ConfigContext } from 'expo/config';
import appConfig from '../app.config';

const originalEnv = process.env;
const context = { config: { name: 'TMap', slug: 'tmap-mobile' } } as ConfigContext;
beforeEach(() => {
  process.env = { ...originalEnv };
  for (const key of ['TMAP_APP_VARIANT', 'EXPO_PUBLIC_DEMO_MODE', 'EXPO_PUBLIC_DEFAULT_MARKET', 'TMAP_IOS_BUNDLE_IDENTIFIER', 'TMAP_ANDROID_PACKAGE', 'EAS_PROJECT_ID', 'EXPO_OWNER']) delete process.env[key];
});
afterEach(() => { process.env = originalEnv; });

it('configures both native platforms and a distinct development client', () => {
  const config = appConfig(context);
  expect(config.platforms).toEqual(['ios', 'android']);
  expect(config.android?.package).toBe('com.example.tmap.dev');
  expect(config.ios?.bundleIdentifier).toBe('com.example.tmap.dev');
  expect(config.plugins).toContainEqual(['expo-dev-client', { launchMode: 'launcher' }]);
  expect(config.ios?.infoPlist?.UIBackgroundModes).toBeUndefined();
});

it.each(['preview', 'production'])('blocks %s until project identity is configured', (variant) => {
  process.env.TMAP_APP_VARIANT = variant;
  expect(() => appConfig(context)).toThrow('EAS_PROJECT_ID');
});

it.each(['preview', 'production'])('rejects demo mode for %s', (variant) => {
  process.env.TMAP_APP_VARIANT = variant;
  process.env.EXPO_PUBLIC_DEMO_MODE = 'true';
  expect(() => appConfig(context)).toThrow('Demo mode');
});

it('uses owned production IDs and EAS project metadata without a dev suffix', () => {
  process.env.TMAP_APP_VARIANT = 'production';
  process.env.TMAP_IOS_BUNDLE_IDENTIFIER = 'com.test.tmap';
  process.env.TMAP_ANDROID_PACKAGE = 'com.test.tmap';
  process.env.EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000000';
  const config = appConfig(context);
  expect(config.name).toBe('TMap');
  expect(config.scheme).toBe('tmap');
  expect(config.ios?.bundleIdentifier).toBe('com.test.tmap');
  expect(config.android?.package).toBe('com.test.tmap');
  expect(config.extra?.eas.projectId).toBe(process.env.EAS_PROJECT_ID);
});
