import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { ConnectionProvider, useConnection } from '../state/ConnectionProvider';
import { colors } from '../theme';

function Routes() {
  const { state } = useConnection();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }}>
    <Stack.Protected guard={state.session === null}><Stack.Screen name="index" /></Stack.Protected>
    <Stack.Protected guard={state.session !== null}><Stack.Screen name="remote" /></Stack.Protected>
    <Stack.Screen name="+not-found" />
  </Stack>;
}

export default function RootLayout() {
  return <SafeAreaProvider>
    <StatusBar style="light" />
    {Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? <Screen>
      <Text style={styles.heading}>Install the TMap development build</Text>
      <Text style={styles.body}>TMap requires its own native development build. Follow the Android or iOS setup in the repository README.</Text>
    </Screen> : <ConnectionProvider><Routes /></ConnectionProvider>}
  </SafeAreaProvider>;
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <SafeAreaProvider><Screen><View style={styles.error}>
    <Text accessibilityRole="header" style={styles.heading}>Let’s try that again.</Text>
    <Text style={styles.body}>TMap could not open this screen.</Text>
    <Button label="Try again" onPress={() => { void retry(); }} />
  </View></Screen></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', gap: 20 },
  heading: { color: colors.text, fontSize: 28, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
