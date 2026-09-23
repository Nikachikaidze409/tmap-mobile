import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocationSharing } from '../src/components/LocationSharing';
import { useConnection } from '../src/state/ConnectionProvider';
import { INITIAL_LOCATION_STATE, type LocationState } from '../src/services/location';
import { EMPTY_DIAGNOSTICS } from '../src/services/realtimeTypes';
import { ConnectionController } from '../src/state/connection';
import { createDemoPairingService, createDemoRealtimeService } from '../src/services/demo';

jest.mock('../src/state/ConnectionProvider', () => ({ useConnection: jest.fn() }));
function setup(patch: Partial<LocationState> = {}) {
  const controller = new ConnectionController({ pairing: createDemoPairingService(), createRealtime: createDemoRealtimeService });
  jest.spyOn(controller, 'startLocation').mockResolvedValue();
  jest.spyOn(controller, 'stopLocation').mockResolvedValue();
  jest.spyOn(controller, 'openLocationSettings').mockResolvedValue();
  jest.mocked(useConnection).mockReturnValue({
    controller, location: { ...INITIAL_LOCATION_STATE, ...patch },
    state: { status: 'connected', session: { id: 'test', code: 'ABC123', market: 'AM', mode: 'live' }, message: 'Realtime connected', diagnostics: { ...EMPTY_DIAGNOSTICS } },
  });
  return { controller, view: render(<LocationSharing />) };
}
it('starts only on user action and explains background permission', () => {
  const { controller } = setup();
  expect(controller.startLocation).not.toHaveBeenCalled();
  expect(screen.getByText(/Always on iPhone/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start Sharing Location' }));
  expect(controller.startLocation).toHaveBeenCalledTimes(1);
});
it('shows Settings recovery for denied permission', () => {
  const { controller } = setup({ status: 'denied', message: 'Permission denied', needsSettings: true });
  expect(screen.getByText('Permission denied')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Open System App Settings' }));
  expect(controller.openLocationSettings).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Sharing Location: ON')).toBeNull();
});
it('shows non-coordinate metrics and stops from the real control', () => {
  jest.useFakeTimers();
  try {
    const { controller, view } = setup({ status: 'sharing', active: true, accuracy: 4, timestamp: Date.now() - 3000, successfulSends: 12 });
    expect(screen.getByText('Sharing Location: ON')).toBeTruthy();
    expect(screen.getByText('GPS accuracy: ±4 m')).toBeTruthy();
    expect(screen.getByText('Latest fix age: 3 s')).toBeTruthy();
    expect(screen.getByText('Successful fix sends this app session: 12')).toBeTruthy();
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByText('Latest fix age: 5 s')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Stop Sharing Location' }));
    expect(controller.stopLocation).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
it('does not claim sharing is ON after cleanup fails', () => {
  const { view } = setup({ active: true, status: 'unavailable', message: 'Cleanup failed', needsSettings: true });
  expect(screen.queryByText('Sharing Location: ON')).toBeNull();
  expect(screen.getByText('Location cleanup needed')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Stop Sharing Location' })).toBeTruthy();
  view.unmount();
});
