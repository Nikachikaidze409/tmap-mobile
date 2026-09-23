import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.TMAP_APP_VARIANT ?? 'development';
  if (!['development', 'preview', 'production'].includes(variant)) {
    throw new Error('TMAP_APP_VARIANT must be development, preview, or production.');
  }
  // Keep dynamic config self-contained: Expo does not transpile imported TS files.
  const env = process.env;
  const market = env.EXPO_PUBLIC_DEFAULT_MARKET;
  if (market && market !== 'GE' && market !== 'AM') {
    throw new Error('EXPO_PUBLIC_DEFAULT_MARKET must be GE or AM.');
  }
  const demo = env.EXPO_PUBLIC_DEMO_MODE;
  if (demo && demo !== 'true' && demo !== 'false') {
    throw new Error('EXPO_PUBLIC_DEMO_MODE must be true or false.');
  }
  if (variant !== 'development' && demo === 'true') {
    throw new Error('Demo mode cannot be enabled in preview or production builds.');
  }
  const iosId = process.env.TMAP_IOS_BUNDLE_IDENTIFIER;
  const androidId = process.env.TMAP_ANDROID_PACKAGE;
  const projectId = process.env.EAS_PROJECT_ID;
  if (variant !== 'development' && (!iosId || !androidId || !projectId)) {
    throw new Error('Set TMAP_IOS_BUNDLE_IDENTIFIER, TMAP_ANDROID_PACKAGE, and EAS_PROJECT_ID before release builds.');
  }
  const suffix = variant === 'production' ? '' : variant === 'preview' ? '.preview' : '.dev';
  return {
    ...config,
    name: variant === 'production' ? 'TMap' : variant === 'preview' ? 'TMap Preview' : 'TMap Dev',
    slug: 'tmap-mobile',
    version: '0.1.0',
    scheme: variant === 'production' ? 'tmap' : `tmap-${variant}`,
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    platforms: ['ios', 'android'],
    icon: './assets/icon.png',
    ios: {
      bundleIdentifier: `${iosId ?? 'com.example.tmap'}${suffix}`,
      supportsTablet: true,
    },
    android: {
      package: `${androidId ?? 'com.example.tmap'}${suffix}`,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#101514',
      },
      predictiveBackGestureEnabled: true,
    },
    plugins: [
      'expo-router',
      ['expo-location', {
        locationWhenInUsePermission: 'TMap uses your driving location to keep the navigation position on your paired Tesla updated.',
        locationAlwaysAndWhenInUsePermission: 'TMap shares your driving location with your paired Tesla while sharing is on, including when this phone is locked or TMap is minimized.',
        isIosBackgroundLocationEnabled: true,
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      }],
      ['expo-secure-store', { configureAndroidBackup: true, faceIDPermission: false }],
      ['expo-dev-client', { launchMode: 'launcher' }],
      ['expo-splash-screen', { backgroundColor: '#101514', image: './assets/splash-icon.png', imageWidth: 120 }],
    ],
    experiments: { typedRoutes: true },
    ...(process.env.EXPO_OWNER ? { owner: process.env.EXPO_OWNER } : {}),
    extra: { ...(projectId ? { eas: { projectId } } : {}) },
  };
};
