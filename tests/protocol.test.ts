import { REMOTE_EVENT_NAMES, type PairedFix, type PairedNavState, type PairedView, type RemoteEvent } from '../src/types/protocol';

const fix: PairedFix = { lat: 41.7, lng: 44.8, accuracy: 8, heading: null, speed: null, timestamp: 1700000000000 };
const nav: PairedNavState = {
  destination: { lat: 40.18, lng: 44.51, name: 'Destination' },
  encodedPolyline: 'encoded', distanceMeters: 1200, durationSeconds: 240,
  steps: [{ instruction: 'Continue', distanceMeters: 1200, polyline: 'encoded' }],
  isRerouting: false, updatedAt: 1700000000000,
};
const view: PairedView = { lat: 41.7, lng: 44.8, zoom: 14, bearing: 90, follow: true, sentAt: 1700000000000 };

it('preserves the production field names and nulls over JSON', () => {
  expect(JSON.parse(JSON.stringify(fix))).toEqual(fix);
  expect(Object.keys(fix).sort()).toEqual(['accuracy', 'heading', 'lat', 'lng', 'speed', 'timestamp']);
  expect(Object.keys(nav).sort()).toEqual(['destination', 'distanceMeters', 'durationSeconds', 'encodedPolyline', 'isRerouting', 'steps', 'updatedAt']);
  expect(Object.keys(nav.steps[0] ?? {}).sort()).toEqual(['distanceMeters', 'instruction', 'polyline']);
  expect(Object.keys(view).sort()).toEqual(['bearing', 'follow', 'lat', 'lng', 'sentAt', 'zoom']);
  const empty: PairedNavState = { ...nav, destination: null, encodedPolyline: null, steps: [] };
  expect(JSON.parse(JSON.stringify(empty))).toEqual(empty);
});

it('supports exactly the six supplied remote event names', () => {
  const events: RemoteEvent[] = [
    { type: 'fix', payload: fix }, { type: 'nav', payload: nav }, { type: 'nav_clear' },
    { type: 'view', payload: view }, { type: 'heartbeat', payload: { t: 1700000000000 } }, { type: 'disconnect', payload: { by: 'phone' } },
  ];
  expect(events.map((event) => event.type)).toEqual(REMOTE_EVENT_NAMES);
});
