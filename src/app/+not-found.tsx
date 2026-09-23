import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useConnection } from '../state/ConnectionProvider';
import { colors } from '../theme';

export default function NotFound() {
  const { state } = useConnection();
  return <Screen>
    <Text accessibilityRole="header" style={styles.title}>This road ends here.</Text>
    <Button label="Back to TMap" onPress={() => router.replace(state.session ? '/remote' : '/')} />
  </Screen>;
}

const styles = StyleSheet.create({ title: { color: colors.text, fontSize: 32, fontWeight: '600', marginTop: 60 } });
