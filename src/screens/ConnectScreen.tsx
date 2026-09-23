import { useState } from 'react';
import { Keyboard, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Brand } from '../components/Brand';
import { Button } from '../components/Button';
import { ConnectionArt } from '../components/ConnectionArt';
import { MarketPicker } from '../components/MarketPicker';
import { Screen } from '../components/Screen';
import { environment } from '../config/environment';
import { isValidPairingCode } from '../services/pairing';
import { useConnection } from '../state/ConnectionProvider';
import { colors } from '../theme';
import { Diagnostics } from '../components/Diagnostics';

export function ConnectScreen() {
  const { state, controller } = useConnection();
  const [code, setCode] = useState('');
  const [market, setMarket] = useState(environment.defaultMarket);
  const connecting = state.status === 'connecting';
  const valid = isValidPairingCode(code);
  const submit = () => {
    if (!valid || connecting) return;
    Keyboard.dismiss();
    void controller.connect(code, market);
  };

  return <Screen>
    <View style={styles.header}>
      <Brand />
      <MarketPicker value={market} onChange={setMarket} disabled={connecting} />
    </View>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>YOUR TESLA COMPANION</Text>
      <Text accessibilityRole="header" style={styles.title}>Your drive.{ '\n' }In sync.</Text>
      <Text style={styles.description}>Connect your phone to TMap on your Tesla display.</Text>
    </View>
    <ConnectionArt />
    <View style={styles.form}>
      <View style={styles.formHeading}>
        <Text style={styles.label}>Pairing code</Text>
        <Text style={styles.hint}>6 characters</Text>
      </View>
      <TextInput
        accessibilityLabel="6-character pairing code"
        accessibilityHint="Enter the six letters or numbers displayed in TMap on your Tesla."
        testID="pairing-code"
        value={code}
        onChangeText={(text) => setCode(text.toUpperCase())}
        editable={!connecting}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        keyboardType="ascii-capable"
        returnKeyType="go"
        onSubmitEditing={submit}
        placeholder="ABC123"
        placeholderTextColor="#748477"
        selectionColor={colors.accent}
        style={styles.input}
      />
      <View style={styles.status} accessible accessibilityLabel={state.message} accessibilityLiveRegion="polite" accessibilityRole={state.status === 'error' ? 'alert' : 'text'}>
        <View style={[styles.statusDot, state.status === 'error' && styles.errorDot]} />
        <Text style={[styles.statusText, state.status === 'error' && styles.errorText]}>{state.message}</Text>
      </View>
      <Button label={connecting ? 'Connecting…' : 'Connect'} onPress={submit} disabled={!valid} loading={connecting} />
      {connecting && <Button label="Cancel connection" onPress={() => { void controller.disconnect('Connection cancelled.', false); }} secondary />}
    </View>
    {environment.demoMode && <View style={styles.demo}>
      <Text style={styles.demoTitle}>DEMO MODE</Text>
      <Text style={styles.demoText}>Use TMAP26 to explore. No Tesla will be connected.</Text>
    </View>}
    <View style={styles.instructions}>
      <Text style={styles.helpTitle}>Find your pairing code</Text>
      <View style={styles.step}><Text style={styles.number}>01</Text><Text style={styles.stepText}>Open TMap in your Tesla browser.</Text></View>
      <View style={styles.step}><Text style={styles.number}>02</Text><Text style={styles.stepText}>Open phone pairing to get your code.</Text></View>
    </View>
    <Diagnostics />
    <Text style={styles.footer}>PHONE + TESLA. ONE JOURNEY.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' },
  hero: { gap: 12 },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  title: { fontSize: 46, lineHeight: 50, letterSpacing: -2, fontWeight: '600', color: colors.text },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 310 },
  form: { gap: 14 },
  formHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 12 },
  input: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12, color: colors.text, fontSize: 30, letterSpacing: 9, textAlign: 'center', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  status: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  errorDot: { backgroundColor: colors.error },
  statusText: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 },
  errorText: { color: colors.error },
  demo: { padding: 16, backgroundColor: colors.surface, borderRadius: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
  demoTitle: { color: colors.demo, fontSize: 11, letterSpacing: 1.5, fontWeight: '700' },
  demoText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  instructions: { gap: 12 },
  helpTitle: { fontSize: 14, color: colors.text, fontWeight: '600', marginBottom: 2 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  number: { color: colors.accent, fontSize: 11, lineHeight: 21, fontWeight: '600' },
  stepText: { color: colors.muted, fontSize: 13, lineHeight: 21, flex: 1 },
  footer: { color: colors.muted, fontSize: 9, fontWeight: '500', letterSpacing: 1.8, textAlign: 'center', marginTop: 'auto', paddingTop: 8, paddingBottom: 8 },
});
