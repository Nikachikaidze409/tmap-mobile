import { StyleSheet, Text, View } from 'react-native';
import { Logo } from './Icon';
import { colors } from '../theme';

export function Brand() {
  return <View style={styles.brand} accessibilityLabel="TMap">
    <Logo />
    <Text style={styles.title}>TMap<Text style={styles.dot}>.</Text></Text>
  </View>;
}

const styles = StyleSheet.create({
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: colors.text, fontSize: 26, fontWeight: '700', letterSpacing: -1 },
  dot: { color: colors.accent },
});
