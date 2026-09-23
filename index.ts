// Headless native tasks must be registered before Expo Router starts React.
import './src/background/registerTasks';
import 'expo-router/entry';
