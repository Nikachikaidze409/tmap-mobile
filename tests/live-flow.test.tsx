import { AppState } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '../src/app/_layout';
import Connect from '../src/app/index';
import Remote from '../src/app/remote';
import NotFound from '../src/app/+not-found';
import type { SubscriptionStatus } from '../src/services/supabase';

let mockStatus: (status: SubscriptionStatus) => void;
let mockMessage: (event: string, payload: unknown) => void;
const mockSend = jest.fn(async () => 'ok');
const mockDispose = jest.fn(async () => {});
const mockFactory = jest.fn(() => ({
  onBroadcast: (listener: typeof mockMessage) => { mockMessage = listener; },
  subscribe: (listener: typeof mockStatus) => { mockStatus = listener; },
  send: mockSend, dispose: mockDispose,
}));
jest.mock('../src/services/supabase', () => ({ createSupabaseBroadcastFactory: () => mockFactory }));
jest.mock('../src/config/environment', () => ({ environment: { defaultMarket: 'GE', demoMode: false, supabaseUrl: '', supabasePublishableKey: '' } }));
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return { ...actual, default: { ...actual.default, executionEnvironment: 'bare' } };
});
const originalAppState = AppState.currentState;
beforeEach(() => {
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => { AppState.currentState = originalAppState; jest.restoreAllMocks(); });

function renderLive() {
  return renderRouter({ _layout: RootLayout, index: Connect, remote: Remote, '+not-found': NotFound });
}
async function enterCode() {
  fireEvent.changeText(screen.getByLabelText('6-character pairing code'), 'ABC123');
  fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(mockFactory).toHaveBeenCalledTimes(1));
}

it('shows realtime-connected only after SUBSCRIBED and returns to Connect on Tesla disconnect', async () => {
  const result = renderLive();
  await enterCode();
  expect(result.getPathname()).toBe('/');
  expect(screen.queryByText('Realtime connected')).toBeNull();
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => { mockStatus('SUBSCRIBED'); });
  await waitFor(() => expect(result.getPathname()).toBe('/remote'));
  expect(screen.getByText('Realtime connected')).toBeTruthy();
  expect(screen.getByText('Developer diagnostics')).toBeTruthy();
  expect(screen.getByText('ABC123')).toBeTruthy();
  expect(screen.getByText('SUBSCRIBED')).toBeTruthy();
  expect(mockSend).toHaveBeenCalledWith('heartbeat', expect.objectContaining({ t: expect.any(Number) }), 1500);
  await act(async () => { mockMessage('disconnect', { by: 'tesla' }); });
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  expect(screen.getByText('Disconnected by Tesla')).toBeTruthy();
  expect(screen.queryByText('ABC123')).toBeNull();
  expect(mockDispose).toHaveBeenCalledTimes(1);
  expect(mockSend).toHaveBeenCalledTimes(1); // No disconnect echo.
});

it('changes the UI on lifecycle pause/resume and cleans up AppState on unmount', async () => {
  let onChange: (state: 'active' | 'background') => void = () => {};
  const remove = jest.fn();
  jest.mocked(AppState.addEventListener).mockImplementation((_event, listener) => {
    onChange = listener;
    return { remove };
  });
  const result = renderLive();
  await enterCode();
  await act(async () => { mockStatus('SUBSCRIBED'); });
  await waitFor(() => expect(screen.getByText('Realtime connected')).toBeTruthy());
  await act(async () => { onChange('background'); });
  expect(screen.getByText('Connection paused')).toBeTruthy();
  expect(screen.queryByText('Realtime connected')).toBeNull();
  expect(mockDispose).toHaveBeenCalledTimes(1);
  await act(async () => { onChange('active'); });
  expect(screen.getByText('Reconnecting to Tesla channel…')).toBeTruthy();
  expect(mockFactory).toHaveBeenCalledTimes(2);
  await act(async () => { mockStatus('SUBSCRIBED'); });
  expect(screen.getByText('Realtime connected')).toBeTruthy();
  result.unmount();
  await act(async () => {});
  expect(remove).toHaveBeenCalledTimes(1);
  expect(mockDispose).toHaveBeenCalledTimes(2);
});

it('broadcasts a deliberate phone disconnect before returning to Connect', async () => {
  const result = renderLive();
  await enterCode();
  await act(async () => { mockStatus('SUBSCRIBED'); });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy());
  fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  expect(mockSend).toHaveBeenLastCalledWith('disconnect', { by: 'phone' }, 500);
  expect(mockDispose).toHaveBeenCalledTimes(1);
});
