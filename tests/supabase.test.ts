import { createClient } from '@supabase/supabase-js';
import { createSupabaseBroadcastFactory, validateSupabaseConfiguration } from '../src/services/supabase';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const config = { url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test_fixture' };

function setup() {
  const channel = { state: 'joined', on: jest.fn(), subscribe: jest.fn(), send: jest.fn(async () => 'ok'), teardown: jest.fn() };
  const client = {
    channel: jest.fn(() => channel), removeChannel: jest.fn(async () => 'ok'),
    realtime: { isConnected: jest.fn(() => true), disconnect: jest.fn(async () => {}) },
  };
  // Only this SDK boundary is mocked; lifecycle tests use the real service above it.
  jest.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
  return { client, channel, connection: createSupabaseBroadcastFactory(config)('pair-abc123') };
}

it('uses the RN client with no persisted auth/session and the production channel options', () => {
  const { client, channel, connection } = setup();
  expect(createClient).toHaveBeenCalledWith(config.url, config.publishableKey, expect.objectContaining({ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }));
  expect(client.channel).toHaveBeenCalledWith('pair-abc123', { config: { broadcast: { ack: true, self: false }, private: false } });
  const onStatus = jest.fn();
  connection.subscribe(onStatus);
  expect(channel.subscribe).toHaveBeenCalledWith(onStatus);
});

it('maps broadcasts to Supabase event and payload without adding fields', async () => {
  const { channel, connection } = setup();
  await connection.send('heartbeat', { t: 123 }, 1500);
  expect(channel.send).toHaveBeenCalledWith({ type: 'broadcast', event: 'heartbeat', payload: { t: 123 } }, { timeout: 1500 });
  await connection.send('disconnect', { by: 'phone' }, 500);
  expect(channel.send).toHaveBeenLastCalledWith({ type: 'broadcast', event: 'disconnect', payload: { by: 'phone' } }, { timeout: 500 });
  const listener = jest.fn();
  connection.onBroadcast(listener);
  const callback = channel.on.mock.calls[0]?.[2] as (message: { event: string; payload: unknown }) => void;
  callback({ event: 'disconnect', payload: { by: 'tesla' } });
  expect(listener).toHaveBeenCalledWith('disconnect', { by: 'tesla' });
});

it('never uses HTTP fallback when not joined or when the socket is offline', async () => {
  const { channel, client, connection } = setup();
  channel.state = 'joining';
  expect(await connection.send('heartbeat', { t: 1 }, 1500)).toBe('error');
  channel.state = 'joined';
  client.realtime.isConnected.mockReturnValue(false);
  expect(await connection.send('heartbeat', { t: 1 }, 1500)).toBe('error');
  expect(channel.send).not.toHaveBeenCalled();
});

it('removes the channel, closes SDK reconnection/socket resources and tears down timers', async () => {
  const { channel, client, connection } = setup();
  await connection.dispose();
  await connection.dispose();
  expect(client.removeChannel).toHaveBeenCalledTimes(1);
  expect(client.removeChannel).toHaveBeenCalledWith(channel);
  expect(client.realtime.disconnect).toHaveBeenCalledTimes(1);
  expect(channel.teardown).toHaveBeenCalledTimes(1);
});

it('still tears down the channel when removal acknowledgement never arrives', async () => {
  jest.useFakeTimers();
  try {
    const { channel, client, connection } = setup();
    client.removeChannel.mockReturnValueOnce(new Promise(() => {}));
    const closing = connection.dispose();
    await jest.advanceTimersByTimeAsync(500);
    await closing;
    expect(client.realtime.disconnect).toHaveBeenCalledTimes(1);
    expect(channel.teardown).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});

it.each(['sb_secret_not_allowed', 'eyJ.service_role.signature', 'eyJ.admin.signature', 'not-a-key'])('rejects non-publishable credentials without echoing their values', (publishableKey) => {
  expect(() => validateSupabaseConfiguration({ ...config, publishableKey })).toThrow('INVALID_CONFIG');
});
it.each(['http://example.supabase.co', 'not-a-url', 'https://user:password@example.supabase.co', 'https://example.supabase.co/?token=value'])('rejects unsafe/malformed project URLs', (url) => {
  expect(() => validateSupabaseConfiguration({ ...config, url })).toThrow('INVALID_CONFIG');
});
it('reports missing public configuration without making a client', () => {
  expect(() => createSupabaseBroadcastFactory({ url: '', publishableKey: '' })('pair-abc123')).toThrow('NOT_CONFIGURED');
  expect(createClient).not.toHaveBeenCalled();
});
