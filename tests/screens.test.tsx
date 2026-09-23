import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ConnectionProvider, useConnection } from '../src/state/ConnectionProvider';
import { ConnectScreen } from '../src/screens/ConnectScreen';
import { RemoteScreen } from '../src/screens/RemoteScreen';

jest.mock('../src/config/environment', () => ({ environment: { defaultMarket: 'GE', demoMode: true } }));

function Flow() {
  const { state } = useConnection();
  return state.session ? <RemoteScreen /> : <ConnectScreen />;
}

it('validates, pairs in the selected market, shows placeholders, and disconnects', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<ConnectionProvider><Flow /></ConnectionProvider>);
  expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  fireEvent.press(screen.getByRole('radio', { name: 'Armenia' }));
  fireEvent.changeText(screen.getByLabelText('6-character pairing code'), 'tmap26');
  expect(screen.getByDisplayValue('TMAP26')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(screen.getByText('Demo connected')).toBeTruthy());
  expect(screen.getByText('Armenia · AM')).toBeTruthy();
  expect(screen.getByText('Demo only · no vehicle connected')).toBeTruthy();
  for (const title of ['Speak Destination', 'Search Destination', 'Share Location', 'Control Map', 'Speedometer']) {
    fireEvent.press(screen.getByRole('button', { name: `${title}, coming soon` }));
    expect(alert).toHaveBeenLastCalledWith(title, expect.stringContaining('Coming soon'), [{ text: 'Got it' }]);
  }
  fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled());
  expect(screen.getByText('Disconnected. Ready to pair again.')).toBeTruthy();
  alert.mockRestore();
});

it('shows an accessible error and allows a corrected pairing code', async () => {
  render(<ConnectionProvider><Flow /></ConnectionProvider>);
  fireEvent.changeText(screen.getByLabelText('6-character pairing code'), 'ABC123');
  fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.getByText('That code was not recognized. Check the code and try again.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('6-character pairing code'), 'TMAP26');
  fireEvent(screen.getByLabelText('6-character pairing code'), 'submitEditing');
  await waitFor(() => expect(screen.getByText('Demo connected')).toBeTruthy());
});
