import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  secondary?: boolean;
  icon?: IconName;
}

export function Button({ label, onPress, disabled = false, loading = false, secondary = false, icon }: ButtonProps) {
  const ink = secondary ? colors.text : colors.accentInk;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    disabled={disabled || loading}
    onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}
  >
    <View style={styles.content}>
      {loading ? <ActivityIndicator color={ink} /> : icon ? <Icon name={icon} color={ink} size={20} /> : null}
      <Text style={[styles.label, { color: ink }]}>{label}</Text>
    </View>
    {!secondary && !loading && <Icon name="arrow" color={ink} size={20} />}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 56, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, backgroundColor: colors.accent, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  label: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
