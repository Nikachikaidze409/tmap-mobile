import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import RootLayout from '../src/app/_layout';
import Connect from '../src/app/index';
import Remote from '../src/app/remote';
import NotFound from '../src/app/+not-found';

jest.mock('../src/config/environment', () => ({ environment: { defaultMarket: 'GE', demoMode: true } }));
jest.mock('expo-constants', () => {
  const actual = jest.requireActual('expo-constants');
  return { ...actual, default: { ...actual.default, executionEnvironment: 'bare' } };
});

it('guards deep links and removes the remote route after disconnect', async () => {
  const result = renderRouter({ _layout: RootLayout, index: Connect, remote: Remote, '+not-found': NotFound }, { initialUrl: '/remote' });
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  fireEvent.changeText(screen.getByLabelText('6-character pairing code'), 'TMAP26');
  fireEvent.press(screen.getByRole('button', { name: 'Connect' }));
  await waitFor(() => expect(result.getPathname()).toBe('/remote'));
  fireEvent.press(screen.getByRole('button', { name: 'Disconnect' }));
  await waitFor(() => expect(result.getPathname()).toBe('/'));
  expect(screen.queryByText('Demo connected')).toBeNull();
});
