import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName = 'arrow' | 'mic' | 'search' | 'pin' | 'map' | 'speed' | 'disconnect' | 'check' | 'link';

const paths: Record<IconName, string> = {
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  mic: 'M8 6a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0V6Zm-3 5v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8',
  search: 'm16 16 5 5M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z',
  pin: 'M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13Zm0-16a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  map: 'm3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17',
  speed: 'M4 19a10 10 0 1 1 16 0H4Zm8-7 5-5M3 12h2m7-9v2m7 7h2',
  disconnect: 'M12 2v10M6 5a9 9 0 1 0 12 0',
  check: 'm5 12 4 4L19 6',
  link: 'm10 14 4-4m-6 6-1 1a4.25 4.25 0 0 1-6-6l4-4a4.25 4.25 0 0 1 6 0m2 10a4.25 4.25 0 0 0 6 0l4-4a4.25 4.25 0 0 0-6-6l-1 1',
};

export function Icon({ name, size = 24, color = colors.text }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
    <Path d={paths[name]} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function Logo({ size = 38 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 48 48" accessible={false}>
    <Rect width="48" height="48" rx="14" fill={colors.accent} />
    <Path d="M12 31V19a5 5 0 0 1 5-5h19M26 14v22" stroke={colors.accentInk} strokeWidth="4" fill="none" strokeLinecap="round" />
    <Circle cx="12" cy="35" r="2" fill={colors.accentInk} />
  </Svg>;
}
