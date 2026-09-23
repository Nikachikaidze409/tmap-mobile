import type { PairedFix } from '../types/protocol';

export interface FixTelemetry {
  accuracy: number | null;
  timestamp: number | null;
  successfulSends: number;
  delivery: 'idle' | 'sent' | 'failed';
}
/** Process-local counters and latest non-coordinate measurements. No history. */
export class LocationTelemetry {
  private state: FixTelemetry = { accuracy: null, timestamp: null, successfulSends: 0, delivery: 'idle' };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<FixTelemetry>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  received(fix: PairedFix) { this.update({ accuracy: fix.accuracy, timestamp: fix.timestamp }); }
  sent() { this.update({ successfulSends: this.state.successfulSends + 1, delivery: 'sent' }); }
  failed() { this.update({ delivery: 'failed' }); }
  clearLatest() { this.update({ accuracy: null, timestamp: null, delivery: 'idle' }); }
}
