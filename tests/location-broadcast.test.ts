import { createClient } from '@supabase/supabase-js';
import { createLocationBroadcaster } from '../src/services/locationBroadcast';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test_fixture' };
const fix = { lat: 41, lng: 44, accuracy: 4, heading: null, speed: null, timestamp: 123 };
function harness() {
  const channel = { httpSend: jest.fn(async () => ({ success: true })), subscribe: jest.fn(), teardown: jest.fn() };
  const client = { channel: jest.fn(() => channel), removeChannel: jest.fn(async () => 'ok'), realtime: { connect: jest.fn(), disconnect: jest.fn(async () => {}) } };
  jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
  return { client, channel, send: createLocationBroadcaster(config) };
}
it('uses the exact public channel and fix payload with HTTP; never subscribes a socket', async () => {
  const h = harness();
  expect(await h.send('AbC123', fix)).toBe(true);
  expect(h.client.channel).toHaveBeenCalledWith('pair-abc123', { config: { broadcast: { self: false }, private: false } });
  expect(h.channel.httpSend).toHaveBeenCalledWith('fix', fix, { timeout: 4000 });
  expect(h.channel.subscribe).not.toHaveBeenCalled();
  expect(h.client.realtime.connect).not.toHaveBeenCalled();
  expect(h.client.removeChannel).toHaveBeenCalledWith(h.channel);
  expect(h.channel.teardown).toHaveBeenCalledTimes(1);
});
it('returns a safe failure and releases the HTTP-only channel if the request rejects', async () => {
  const h = harness(); h.channel.httpSend.mockRejectedValueOnce(new Error('raw server detail'));
  expect(await h.send('ABC123', fix)).toBe(false);
  expect(h.client.removeChannel).toHaveBeenCalledTimes(1);
});
it('validates configuration before sending', async () => {
  const h = harness();
  expect(await createLocationBroadcaster({ url: '', publishableKey: '' })('ABC123', fix)).toBe(false);
  expect(h.channel.httpSend).not.toHaveBeenCalled();
});

it('works with the real installed SDK using only its HTTP fetch boundary', async () => {
  jest.useFakeTimers();
  try {
  const sdk = jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
  const fetch = jest.fn(async () => new Response(null, { status: 202 }));
  const client = sdk.createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  const connect = jest.spyOn(client.realtime, 'connect');
  jest.mocked(createClient).mockReturnValueOnce(client as unknown as ReturnType<typeof createClient>);
  expect(await createLocationBroadcaster(config)('ABC123', fix)).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/pair-abc123/events/fix'), expect.objectContaining({ body: JSON.stringify(fix), method: 'POST' }));
  expect(connect).not.toHaveBeenCalled();
  expect(client.getChannels()).toHaveLength(0);
  // Pinned realtime-js socketAdapter leaves its bounded 10s disconnect deadline
  // scheduled even when closing an unopened socket resolves immediately.
  await jest.advanceTimersByTimeAsync(10_000);
  expect(jest.getTimerCount()).toBe(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
