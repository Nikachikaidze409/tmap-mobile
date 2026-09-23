import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { environment } from '../config/environment';
import { createServices } from '../services';
import { ConnectionController } from './connection';
import { AppState } from 'react-native';

const ConnectionContext = createContext<ConnectionController | null>(null);

export function ConnectionProvider({ children }: PropsWithChildren) {
  const [controller] = useState(() => new ConnectionController(createServices(environment.demoMode, {
    url: environment.supabaseUrl, publishableKey: environment.supabasePublishableKey,
  })));
  useEffect(() => {
    controller.setAppActive(AppState.currentState === null || AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => controller.setAppActive(state === 'active'));
    return () => {
      subscription.remove();
      void controller.disconnect('Session ended.', false);
    };
  }, [controller]);
  return <ConnectionContext.Provider value={controller}>{children}</ConnectionContext.Provider>;
}

export function useConnection() {
  const controller = useContext(ConnectionContext);
  if (!controller) throw new Error('useConnection requires ConnectionProvider');
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { state, controller };
}
