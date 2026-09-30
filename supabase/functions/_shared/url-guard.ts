// Guards for fetching user-supplied URLs server-side (docs/ARCHITECTURE.md#security). Pure functions,
// no Deno APIs, so they run under Vitest too.

export type GuardFailure =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'credentials-in-url'
  | 'unsupported-port'
  | 'blocked-address';

export type GuardResult =
  { ok: true; url: URL } | { ok: false; reason: GuardFailure };

const MAX_URL_LENGTH = 2000;

/** Shape checks that need no network: scheme, credentials, port, literal IP addresses. */
export function checkUrl(raw: string): GuardResult {
  if (raw.length > MAX_URL_LENGTH) return { ok: false, reason: 'invalid-url' };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'invalid-url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    return { ok: false, reason: 'unsupported-scheme' };
  if (url.username || url.password)
    return { ok: false, reason: 'credentials-in-url' };
  if (url.port && url.port !== '80' && url.port !== '443')
    return { ok: false, reason: 'unsupported-port' };

  // A trailing dot is the same host to DNS ("localhost." is localhost).
  const host = url.hostname
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '')
    .toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return { ok: false, reason: 'blocked-address' };
  }
  if (isIpLiteral(host) && isBlockedIp(host))
    return { ok: false, reason: 'blocked-address' };
  return { ok: true, url };
}

/** Whether a hostname (without IPv6 brackets) is an IP address rather than a name to resolve. */
export function isIpLiteral(host: string): boolean {
  return isIpv4(host) || host.includes(':');
}

function isIpv4(value: string): boolean {
  return (
    /^\d{1,3}(\.\d{1,3}){3}$/.test(value) &&
    value.split('.').every((p) => Number(p) <= 255)
  );
}

function ipv4ToInt(ip: string): number {
  return (
    ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0
  );
}

// [network, prefix length]
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, broadcast
];

function inV4Range(ip: string, [network, bits]: [string, number]): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network) & mask);
}

/** Expand an IPv6 address to 8 hextets (handles "::" and embedded IPv4). */
function ipv6Hextets(ip: string): number[] | undefined {
  let addr = ip.toLowerCase().split('%')[0] ?? '';
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
  if (v4?.[1]) {
    if (!isIpv4(v4[1])) return undefined;
    const n = ipv4ToInt(v4[1]);
    addr =
      addr.slice(0, -v4[1].length) +
      `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head = '', tail] = addr.split('::');
  if (addr.split('::').length > 2) return undefined;
  const parse = (s: string) =>
    s ? s.split(':').map((h) => parseInt(h, 16)) : [];
  const a = parse(head);
  const b = tail === undefined ? [] : parse(tail);
  const hextets =
    tail === undefined
      ? a
      : [...a, ...new Array(8 - a.length - b.length).fill(0), ...b];
  return hextets.length === 8 &&
    hextets.every((h) => Number.isInteger(h) && h >= 0 && h <= 0xffff)
    ? hextets
    : undefined;
}

/** True for addresses a server-side fetch must never reach: private, loopback, link-local, metadata, etc. */
export function isBlockedIp(ip: string): boolean {
  if (isIpv4(ip)) return BLOCKED_V4.some((range) => inV4Range(ip, range));
  const h = ipv6Hextets(ip);
  if (!h) return true; // unparseable: refuse
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, last = 0] = h;
  const embeddedV4 = (hi: number, lo: number) =>
    isBlockedIp(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  // ::/96 (IPv4-compatible, also covers :: and ::1), ::ffff:0:0/96 (mapped), ::ffff:0:0:0/96 (SIIT)
  if (a === 0 && b === 0 && c === 0 && d === 0) {
    if (e === 0 && (f === 0 || f === 0xffff)) return embeddedV4(g, last);
    if (e === 0xffff && f === 0) return embeddedV4(g, last);
  }
  // NAT64: decode the well-known 64:ff9b::/96; block the rest of 64:ff9b::/32 (incl. local-use 64:ff9b:1::/48)
  if (a === 0x64 && b === 0xff9b)
    return c === 0 && d === 0 && e === 0 && f === 0
      ? embeddedV4(g, last)
      : true;
  if (a === 0x100 && b === 0 && c === 0 && d === 0) return true; // 100::/64 discard
  if (a === 0x2002) return embeddedV4(b, c); // 6to4
  if (a === 0x2001 && b === 0) return true; // Teredo
  if ((a & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((a & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((a & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (a === 0x2001 && b === 0x0db8) return true; // documentation
  return false;
}
