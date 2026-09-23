import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Brand } from '../components/Brand';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Screen } from '../components/Screen';
import { MARKETS } from '../config/market';
import { useConnection } from '../state/ConnectionProvider';
import { colors } from '../theme';
import { Diagnostics } from '../components/Diagnostics';

const actions: { title: string; detail: string; icon: IconName }[] = [
  { title: 'Search Destination', detail: 'Find your next stop', icon: 'search' },
  { title: 'Share Location', detail: 'Send your position', icon: 'pin' },
  { title: 'Control Map', detail: 'A different perspective', icon: 'map' },
  { title: 'Speedometer', detail: 'Your pace, at a glance', icon: 'speed' },
];

function comingSoon(title: string) {
  Alert.alert(title, 'Coming soon. This feature will be available in a future update.', [{ text: 'Got it' }]);
}

export function RemoteScreen() {
  const { state, controller } = useConnection();
  const { fontScale, width } = useWindowDimensions();
  if (!state.session) return null;
  const { session } = state;
  const singleColumn = width < 360 || fontScale > 1.25;

  return <Screen>
    <View style={styles.header}>
      <Brand />
      <Text style={styles.market}>{MARKETS[session.market].name} · {session.market}</Text>
    </View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>YOUR REMOTE</Text>
      <Text accessibilityRole="header" style={styles.title}>Ready for{ '\n' }the road.</Text>
      <Text style={styles.subtitle}>A little closer to wherever you’re going.</Text>
    </View>
    <View style={styles.connection} accessibilityLiveRegion="polite">
      <View style={styles.connectionIcon}><Icon name="link" color={colors.accent} size={22} /></View>
      <View style={styles.connectionText}>
        <Text style={styles.connected}>{state.message}</Text>
        <Text style={[styles.connectionDetail, session.mode === 'demo' && styles.demo]}>{session.mode === 'demo' ? 'Demo only · no vehicle connected' : state.status === 'connected' ? 'Tesla channel subscribed · heartbeats active' : 'Heartbeats paused until the channel is ready'}</Text>
      </View>
      <View style={[styles.dot, (session.mode === 'demo' || state.status !== 'connected') && styles.demoDot]} />
    </View>
    <View style={styles.actions}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>At your fingertips</Text>
        <Text style={styles.coming}>COMING SOON</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Speak Destination, coming soon" onPress={() => comingSoon('Speak Destination')} style={({ pressed }) => [styles.voice, pressed && styles.pressed]}>
        <View style={styles.voiceTop}><Icon name="mic" size={28} color={colors.accentInk} /><Icon name="arrow" color={colors.accentInk} size={22} /></View>
        <View style={styles.voiceText}><Text style={styles.voiceTitle}>Speak Destination</Text><Text style={styles.voiceDetail}>Say where. We’ll take it from there.</Text></View>
      </Pressable>
      <View style={styles.grid}>
        {actions.map((action) => <Pressable key={action.title} accessibilityRole="button" accessibilityLabel={`${action.title}, coming soon`} onPress={() => comingSoon(action.title)} style={({ pressed }) => [styles.tile, singleColumn && styles.fullTile, pressed && styles.pressed]}>
          <Icon name={action.icon} color={colors.accent} size={25} />
          <View style={styles.tileText}><Text style={styles.tileTitle}>{action.title}</Text><Text style={styles.tileDetail}>{action.detail}</Text></View>
        </Pressable>)}
      </View>
    </View>
    <Diagnostics />
    <View style={styles.footer}>
      <Button label={state.status === 'disconnecting' ? 'Disconnecting…' : 'Disconnect'} icon="disconnect" secondary loading={state.status === 'disconnecting'} onPress={() => { void controller.disconnect(); }} />
      <Text style={styles.footerText}>Make changes while safely parked.</Text>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
  market: { fontSize: 12, color: colors.muted },
  hero: { gap: 12 },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { fontSize: 44, lineHeight: 49, color: colors.text, fontWeight: '600', letterSpacing: -1.8 },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.muted },
  connection: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border },
  connectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  connectionText: { flex: 1, gap: 5 },
  connected: { color: colors.text, fontSize: 14, fontWeight: '600' },
  connectionDetail: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  demo: { color: colors.demo },
  demoDot: { backgroundColor: colors.demo },
  actions: { gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 15, color: colors.text, fontWeight: '600' },
  coming: { color: colors.muted, fontSize: 9, letterSpacing: 1.1 },
  voice: { borderRadius: 20, backgroundColor: colors.accent, padding: 22, gap: 28 },
  voiceTop: { flexDirection: 'row', justifyContent: 'space-between' },
  voiceText: { gap: 6 },
  voiceTitle: { fontSize: 20, color: colors.accentInk, fontWeight: '600', letterSpacing: -0.5 },
  voiceDetail: { fontSize: 13, color: colors.accentInk, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '48%', flexGrow: 1, minHeight: 148, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 18, justifyContent: 'space-between', gap: 24 },
  fullTile: { width: '100%' },
  tileText: { gap: 6 },
  tileTitle: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  tileDetail: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.75 },
  footer: { marginTop: 'auto', gap: 16 },
  footerText: { fontSize: 11, color: colors.muted, textAlign: 'center', paddingBottom: 8 },
});
