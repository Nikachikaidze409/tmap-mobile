import { parseDefaultMarket } from './market';

export function parseDemoMode(value: string | undefined, development: boolean): boolean {
  if (value !== undefined && value !== '' && value !== 'true' && value !== 'false') {
    throw new Error('EXPO_PUBLIC_DEMO_MODE must be true or false.');
  }
  return development && value === 'true';
}

// Expo statically replaces direct EXPO_PUBLIC_* accesses. These are not secrets.
export const environment = {
  defaultMarket: parseDefaultMarket(process.env.EXPO_PUBLIC_DEFAULT_MARKET),
  demoMode: parseDemoMode(process.env.EXPO_PUBLIC_DEMO_MODE, __DEV__),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
} as const;
