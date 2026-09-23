import { StyleSheet, Text, View } from 'react-native';
import { useConnection } from '../state/ConnectionProvider';
import { colors } from '../theme';

/** Development-only diagnostics: no URLs, keys, tokens, or server error text. */
export function Diagnostics() {
  const { state } = useConnection();
  if (!__DEV__) return null;
  const d = state.diagnostics;
  const rows = [
    ['Pairing code', d.pairingCode ?? '—'],
    ['Channel state', d.channelState],
    ['Last heartbeat sent', d.lastHeartbeatSent === null ? '—' : new Date(d.lastHeartbeatSent).toISOString()],
    ['Received messages', String(d.receivedMessageCount)],
    ['Reconnect count', String(d.reconnectCount)],
  ];
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Developer diagnostics</Text>
    {rows.map(([label, value]) => <View key={label} style={styles.row}>
      <Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text>
    </View>)}
    <Text style={styles.note}>Heartbeat time is recorded after Supabase acknowledgement. It does not confirm Tesla presence.</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: colors.surface, borderRadius: 16, gap: 12 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.accent, fontSize: 12 },
  note: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
