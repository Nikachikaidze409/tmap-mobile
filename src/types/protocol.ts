/** Exact production payload shapes shared with the TMap web/Tesla app. */
export interface PairedFix {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface PairedNavState {
  destination: {
    lat: number;
    lng: number;
    name: string;
  } | null;
  encodedPolyline: string | null;
  distanceMeters: number;
  durationSeconds: number;
  steps: {
    instruction: string;
    distanceMeters: number;
    polyline: string;
  }[];
  isRerouting: boolean;
  updatedAt: number;
}

export interface PairedView {
  lat: number;
  lng: number;
  zoom: number;
  bearing: number;
  follow: boolean;
  sentAt: number;
}

export const REMOTE_EVENT_NAMES = [
  'fix', 'nav', 'nav_clear', 'view', 'heartbeat', 'disconnect',
] as const;

export type RemoteEventName = (typeof REMOTE_EVENT_NAMES)[number];

export interface HeartbeatPayload { t: number }
export interface DisconnectPayload { by: 'phone' | 'tesla' }

/** Maps directly to Supabase broadcast event/payload; adds no wire fields. */
export type RemoteEvent =
  | { type: 'fix'; payload: PairedFix }
  | { type: 'nav'; payload: PairedNavState }
  | { type: 'view'; payload: PairedView }
  | { type: 'nav_clear'; payload?: unknown }
  | { type: 'heartbeat'; payload: HeartbeatPayload }
  | { type: 'disconnect'; payload: DisconnectPayload };
