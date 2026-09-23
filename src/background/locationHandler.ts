import { newestCurrentFix, MAX_FIX_AGE_MS } from '../location/fix';
import type { DrivingSessionStore } from '../location/sessionStore';
import type { LocationTelemetry } from '../location/telemetry';
import type { SendLocationFix } from '../services/locationBroadcast';
import type { PairedFix } from '../types/protocol';

/** One in-flight send plus ONE replaceable newest fix. Never a historical queue. */
export class LocationDelivery {
  private paused = false;
  private epoch = 0;
  private pending: PairedFix | null = null;
  private running: Promise<void> | null = null;
  private lastTimestamp = 0;
  constructor(private store: DrivingSessionStore, private send: SendLocationFix, private telemetry: LocationTelemetry) {}
  resume() { this.paused = false; this.lastTimestamp = 0; }
  pause() { this.paused = true; ++this.epoch; this.pending = null; }
  async drain() { await this.running; }
  handle = async (body: { data?: unknown; error?: unknown }): Promise<void> => {
    try {
      if (this.paused) return;
      if (body.error) { this.telemetry.failed(); return; }
      const data = body.data;
      const fix = newestCurrentFix(data && typeof data === 'object' && 'locations' in data ? data.locations : null);
      if (!fix || fix.timestamp <= this.lastTimestamp) return;
      if (!this.pending || fix.timestamp > this.pending.timestamp) this.pending = fix;
      if (!this.running) {
        this.running = this.flush().finally(() => { this.running = null; });
      }
      await this.running;
    } catch { this.telemetry.failed(); }
  };
  private async flush(): Promise<void> {
    while (this.pending && !this.paused) {
      const fix = this.pending;
      this.pending = null;
      const epoch = this.epoch;
      try {
        const session = await this.store.read();
        if (!session || this.paused || epoch !== this.epoch || Date.now() - fix.timestamp > MAX_FIX_AGE_MS) continue;
        if (fix.timestamp <= this.lastTimestamp) continue;
        this.lastTimestamp = fix.timestamp;
        this.telemetry.received(fix);
        const ok = await this.send(session.code, fix);
        if (epoch !== this.epoch) continue;
        if (ok) this.telemetry.sent(); else this.telemetry.failed();
      } catch { this.telemetry.failed(); }
    }
  }
}
