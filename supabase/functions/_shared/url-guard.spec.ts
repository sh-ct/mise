import { checkUrl, isBlockedIp, isIpLiteral } from './url-guard.ts';

describe('checkUrl', () => {
  it.each([
    'https://example.com/recipe',
    'http://example.com:80/r',
    'https://example.com:443/r?x=1',
  ])('accepts %s', (url) => {
    expect(checkUrl(url).ok).toBe(true);
  });

  it.each([
    ['not a url', 'invalid-url'],
    [`https://example.com/${'a'.repeat(2100)}`, 'invalid-url'],
    ['ftp://example.com/r', 'unsupported-scheme'],
    ['javascript:alert(1)', 'unsupported-scheme'],
    ['file:///etc/passwd', 'unsupported-scheme'],
    ['https://user:pass@example.com/', 'credentials-in-url'],
    ['https://example.com:8080/', 'unsupported-port'],
    ['http://localhost/', 'blocked-address'],
    ['http://localhost./', 'blocked-address'],
    ['http://foo.internal./', 'blocked-address'],
    ['http://api.localhost/', 'blocked-address'],
    ['http://metadata.google.internal/', 'blocked-address'],
    ['http://printer.local/', 'blocked-address'],
    ['http://127.0.0.1/', 'blocked-address'],
    ['http://169.254.169.254/latest/meta-data/', 'blocked-address'],
    ['http://10.1.2.3/', 'blocked-address'],
    ['http://[::1]/', 'blocked-address'],
    ['http://[::ffff:127.0.0.1]/', 'blocked-address'],
    ['http://[fd00::1]/', 'blocked-address'],
    ['http://2130706433/', 'blocked-address'], // 127.0.0.1 as a decimal integer; URL normalises it
    ['http://0x7f.1/', 'blocked-address'], // hex/short forms, also normalised by URL
  ])('rejects %s (%s)', (url, reason) => {
    expect(checkUrl(url)).toEqual({ ok: false, reason });
  });
});

describe('isBlockedIp', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.1.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '224.0.0.1',
    '255.255.255.255',
  ])('blocks IPv4 %s', (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '93.184.216.34'])(
    'allows public IPv4 %s',
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );

  it.each([
    '::',
    '::1',
    '::ffff:10.0.0.1',
    '::ffff:a00:1',
    '64:ff9b::7f00:1',
    'fc00::1',
    'fdff::1',
    'fe80::1%eth0',
    'ff02::1',
    '2001:db8::1',
    '::ffff:0:7f00:1', // SIIT-translated 127.0.0.1
    '2002:7f00:1::', // 6to4 wrapping 127.0.0.1
    '2002:c0a8:101::1', // 6to4 wrapping 192.168.1.1
    '2001:0:4136:e378:8000:63bf:3fff:fdd2', // Teredo
    '64:ff9b:1::a00:1', // local-use NAT64
    '100::1', // discard
    'not-an-ip',
  ])('blocks IPv6 %s', (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each([
    '2606:4700:4700::1111',
    '2a00:1450:4009:81f::200e',
    '::ffff:8.8.8.8',
    '2002:808:808::1', // 6to4 wrapping 8.8.8.8
  ])('allows public IPv6 %s', (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });
});

describe('isIpLiteral', () => {
  it('tells addresses from names', () => {
    expect(isIpLiteral('93.184.216.34')).toBe(true);
    expect(isIpLiteral('2606:4700::1111')).toBe(true);
    expect(isIpLiteral('1.2.3.example.com')).toBe(false);
    expect(isIpLiteral('example.com')).toBe(false);
  });
});
