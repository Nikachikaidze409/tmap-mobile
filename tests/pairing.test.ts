import { isValidPairingCode, normalizePairingCode, pairChannelName } from '../src/services/pairing';
import { ConnectionController } from '../src/state/connection';
import { createServices } from '../src/services';
import { parseDefaultMarket } from '../src/config/market';
import { parseDemoMode } from '../src/config/environment';

describe('pairing and environment boundaries', () => {
  test.each(['ABC123', '123456', 'abcdef', ' TMAP26 '])('accepts six alphanumeric characters: %s', (code) => {
    expect(isValidPairingCode(code)).toBe(true);
  });
  test.each(['', '12345', '1234567', 'ABC-12', 'AB 123', 'აბგ123', 'ＡＢＣ１２３'])('rejects invalid code: %s', (code) => {
    expect(isValidPairingCode(code)).toBe(false);
  });
  it('normalizes case and outer whitespace without silently deleting invalid characters', () => {
    expect(normalizePairingCode(' abc123 ')).toBe('ABC123');
    expect(normalizePairingCode('ab-123')).toBe('AB-123');
  });
  it('supports both markets and rejects typos', () => {
    expect(parseDefaultMarket('GE')).toBe('GE');
    expect(parseDefaultMarket('AM')).toBe('AM');
    expect(() => parseDefaultMarket('US')).toThrow('GE or AM');
  });
  it('never enables demo in a release runtime', () => {
    expect(parseDemoMode('true', true)).toBe(true);
    expect(parseDemoMode('true', false)).toBe(false);
    expect(parseDemoMode(undefined, true)).toBe(false);
    expect(parseDemoMode('false', true)).toBe(false);
    expect(() => parseDemoMode('yes', true)).toThrow();
  });
  it('does not pretend to pair in the default configuration', async () => {
    const controller = new ConnectionController(createServices(false));
    await controller.connect('ABC123', 'AM');
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', session: null, message: 'Configure the public Supabase URL and publishable key to connect.' });
  });
  it('keeps normalized codes in memory and uses the exact production channel name', async () => {
    expect(pairChannelName(' AbC123 ')).toBe('pair-abc123');
    const session = await createServices(false).pairing.pair({ code: 'abc123', market: 'AM', signal: new AbortController().signal });
    expect(session).toMatchObject({ code: 'ABC123', id: 'pair-abc123', market: 'AM' });
  });
  it('does not implement remote, navigation, voice or location actions yet', async () => {
    const services = createServices(true);
    await expect(services.location.start({ market: 'AM', mode: 'background', onFix: jest.fn(), onError: jest.fn() })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(services.location.requestPermission('background')).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(services.voice.recognizeDestination({ market: 'AM', locale: 'hy-AM', signal: new AbortController().signal })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(services.navigation.search('park', { market: 'GE' }, new AbortController().signal)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(services.remoteMap.setView({ lat: 0, lng: 0, zoom: 10, bearing: 0, follow: true, sentAt: 1 }, { market: 'AM' })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    await expect(services.createRealtime().send({ type: 'nav_clear' })).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });
});
