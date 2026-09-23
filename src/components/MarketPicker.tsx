import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MARKETS } from '../config/market';
import type { Market } from '../types/market';
import { colors } from '../theme';

export function MarketPicker({ value, onChange, disabled }: { value: Market; onChange: (market: Market) => void; disabled: boolean }) {
  return <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Market">
    {(Object.keys(MARKETS) as Market[]).map((market) => <Pressable
      key={market}
      accessibilityRole="radio"
      accessibilityLabel={MARKETS[market].name}
      accessibilityState={{ checked: value === market, disabled }}
      disabled={disabled}
      onPress={() => onChange(market)}
      style={[styles.option, value === market && styles.selected]}
    >
      <Text style={[styles.text, value === market && styles.selectedText]}>{market}</Text>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 3 },
  option: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  selected: { backgroundColor: colors.elevated },
  text: { fontSize: 12, fontWeight: '700', color: colors.muted },
  selectedText: { color: colors.accent },
});
