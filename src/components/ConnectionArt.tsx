import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/** Decorative vector artwork. No map provider, tile downloads or geolocation. */
export function ConnectionArt() {
  return <View style={styles.frame} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
    <Svg width="100%" height="132" viewBox="0 0 340 132" preserveAspectRatio="xMidYMid meet">
      <Path d="M0 40h72l45 44h94l56-60h73M0 96h52l54-59h125l82 83M132 0v29m0 69v34M260 60h80" fill="none" stroke={colors.border} strokeWidth="1" />
      <Circle cx="171" cy="67" r="57" fill="none" stroke={colors.border} strokeWidth="1" />
      <Circle cx="171" cy="67" r="42" fill="none" stroke={colors.border} strokeWidth="1" strokeDasharray="2 5" />
      <Path d="M91 70h148" stroke={colors.accent} strokeWidth="1.5" strokeDasharray="3 5" />
      <Rect x="49" y="38" width="42" height="63" rx="11" fill={colors.surface} stroke={colors.accent} strokeWidth="1.7" />
      <Path d="M64 45h12m-11 49h10" stroke={colors.accent} strokeWidth="2" strokeLinecap="round" />
      <Path d="m65 68 6-8 5 8-5-2-6 2Z" fill={colors.accent} />
      <Rect x="239" y="40" width="66" height="47" rx="7" fill={colors.surface} stroke={colors.accent} strokeWidth="1.7" />
      <Path d="M272 88v10m-14 0h28M247 62h16l8-11h24m-24 0v26" stroke={colors.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <Circle cx="170" cy="69" r="17" fill={colors.accent} />
      <Path d="m163 69 5 5 9-10" fill="none" stroke={colors.accentInk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </View>;
}

const styles = StyleSheet.create({ frame: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.surface } });
