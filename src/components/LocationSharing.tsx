import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useConnection } from '../state/ConnectionProvider';
import { Button } from './Button';
import { colors } from '../theme';

export function LocationSharing() {
  const { state, location, controller } = useConnection();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!location.active) return;
    // Presentation only. This timer never samples GPS or sends network traffic.
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [location.active]);
  const pending = location.status === 'requesting' || location.status === 'starting' || location.status === 'stopping';
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>Share Location</Text>
    <Text style={styles.status} accessibilityLiveRegion="polite">{location.message}</Text>
    {location.active && <>
      <Text style={styles.on}>{location.status === 'sharing' ? 'Sharing Location: ON' : 'Location cleanup needed'}</Text>
      <Text style={styles.detail}>GPS accuracy: {location.accuracy === null ? 'Waiting for GPS' : `±${Math.round(location.accuracy)} m`}</Text>
      <Text style={styles.detail}>Latest fix age: {location.timestamp === null ? '—' : `${Math.max(0, Math.floor((now - location.timestamp) / 1000))} s`}</Text>
      <Text style={styles.detail}>Latest fix: {location.timestamp === null ? '—' : new Date(location.timestamp).toLocaleString()}</Text>
      <Text style={styles.detail}>Successful fix sends this app session: {location.successfulSends}</Text>
      {location.delivery === 'failed' && <Text style={styles.warning}>Latest delivery failed. New GPS fixes will try again when the network is available.</Text>}
    </>}
    {location.reducedAccuracy && <Text style={styles.warning}>Approximate location is enabled. Enable Precise Location in Settings for driving accuracy.</Text>}
    {!location.active && <Text style={styles.detail}>Share your live driving position with your paired Tesla, including while your phone is locked. Choose Always on iPhone or Allow all the time on Android when prompted. No location history is stored.</Text>}
    <Button label={location.active ? 'Stop Sharing Location' : 'Start Sharing Location'}
      loading={pending} disabled={!location.active && state.status !== 'connected'}
      secondary={location.active}
      onPress={() => { void (location.active ? controller.stopLocation() : controller.startLocation()); }} />
    {(location.needsSettings || location.reducedAccuracy) && <Button label="Open System App Settings" secondary onPress={() => { void controller.openLocationSettings(); }} />}
  </View>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '600' },
  status: { color: colors.text, fontSize: 14, lineHeight: 21 },
  on: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  warning: { color: colors.demo, fontSize: 12, lineHeight: 19 },
});
