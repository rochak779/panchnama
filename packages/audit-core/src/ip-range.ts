/**
 * SSRF-relevant IP range checks — implementation.md section 12.1: "Block
 * requests to loopback, link-local, private, and metadata-service IP
 * ranges." Pure: takes an already-resolved IP address literal (from a real
 * DNS lookup performed by the caller — see
 * `packages/audit-cli/src/crawl/ssrf.ts`) and decides whether it falls in a
 * blocked range. Does not itself perform DNS resolution, since that is I/O.
 */

function ipv4ToInt(parts: number[]): number {
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function parseIpv4(ip: string): number[] | undefined {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) {
    return undefined;
  }
  const parts = match.slice(1, 5).map((p) => Number.parseInt(p, 10));
  if (parts.some((p) => p > 255)) {
    return undefined;
  }
  return parts;
}

interface Ipv4Range {
  base: number[];
  prefixLength: number;
}

const IPV4_BLOCKED_RANGES: Ipv4Range[] = [
  { base: [127, 0, 0, 0], prefixLength: 8 }, // loopback
  { base: [10, 0, 0, 0], prefixLength: 8 }, // private
  { base: [172, 16, 0, 0], prefixLength: 12 }, // private
  { base: [192, 168, 0, 0], prefixLength: 16 }, // private
  { base: [169, 254, 0, 0], prefixLength: 16 }, // link-local, incl. 169.254.169.254 metadata service
  { base: [100, 64, 0, 0], prefixLength: 10 }, // carrier-grade NAT (shared address space)
  { base: [0, 0, 0, 0], prefixLength: 8 }, // "this network"
];

function ipv4InRange(ip: number[], range: Ipv4Range): boolean {
  const mask = range.prefixLength === 0 ? 0 : (0xffffffff << (32 - range.prefixLength)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range.base) & mask);
}

/** Checks an IPv6 address (already expanded/normalized to lowercase form by
 * Node's `dns` module, e.g. `::1`, `fe80::1`, `fc00::...`) against blocked
 * ranges: loopback (`::1`), link-local (`fe80::/10`), unique-local
 * (`fc00::/7`), and an IPv4-mapped address embedding a blocked IPv4. */
function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") {
    return true;
  }
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || /^fe[89ab][0-9a-f]:/.test(lower)) {
    return true;
  }
  // fc00::/7 covers prefixes fc00.. through fdff..
  const firstGroup = lower.split(":")[0] ?? "";
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) {
    return true;
  }
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower);
  if (mapped) {
    return isBlockedIpv4OrFalse(mapped[1]!);
  }
  return false;
}

function isBlockedIpv4OrFalse(ip: string): boolean {
  const parts = parseIpv4(ip);
  if (!parts) {
    return false;
  }
  return IPV4_BLOCKED_RANGES.some((range) => ipv4InRange(parts, range));
}

/**
 * Returns true if `ip` (a literal IPv4 or IPv6 address, as returned by a
 * real DNS resolution) falls within a loopback / link-local / private /
 * metadata-service / other reserved range that must never be crawled.
 * Unrecognized/unparsable input is treated as blocked (fail closed).
 */
export function isBlockedIpAddress(ip: string): boolean {
  const trimmed = ip.trim();
  if (trimmed.includes(":")) {
    return isBlockedIpv6(trimmed);
  }
  const parts = parseIpv4(trimmed);
  if (!parts) {
    // Not a recognizable IPv4 literal either — fail closed rather than
    // silently allowing an address this function cannot classify.
    return true;
  }
  return IPV4_BLOCKED_RANGES.some((range) => ipv4InRange(parts, range));
}
