import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const MAX_URL_LENGTH = 256;

/**
 * Validates a user-supplied "base URL" for an OpenAI-compatible LLM endpoint.
 *
 * Rules:
 *   1. Must parse as a valid URL.
 *   2. Scheme must be https.
 *   3. No userinfo (https://user:pass@host).
 *   4. Hostname must not be localhost or a private/reserved IP literal.
 *   5. Non-default ports below 1024 are rejected (443 is allowed).
 *   6. Length ≤ 256 chars.
 *   7. No query, fragment, or non-root path — base URL should be a clean origin
 *      (trailing "/" is allowed but stripped).
 *
 * NOTE: This is storage-time validation. It does NOT defend against DNS
 * rebinding, because the hostname is resolved at request time, not here.
 * Call `assertSafeResolvedHost(url)` from the HTTP client path at request
 * time to close that gap.
 */
export function validateSafeHttpsUrl(
  raw: string,
): { ok: true; normalized: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();

  if (trimmed.length === 0) return { ok: false, reason: 'URL is empty' };
  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, reason: `URL exceeds ${MAX_URL_LENGTH} characters` };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'URL is malformed' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Only https:// URLs are allowed' };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'URL must not include userinfo (user:password)' };
  }

  if (url.search || url.hash) {
    return { ok: false, reason: 'URL must not contain query or fragment' };
  }

  if (url.pathname !== '/' && url.pathname !== '') {
    return { ok: false, reason: 'URL must not contain a path' };
  }

  if (url.port) {
    const portNum = Number(url.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return { ok: false, reason: 'URL has an invalid port' };
    }
    if (portNum < 1024 && portNum !== 443) {
      return { ok: false, reason: 'URL port must be 443 or ≥ 1024' };
    }
  }

  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostLiteral(hostname)) {
    return { ok: false, reason: 'URL points to a disallowed host' };
  }

  const normalized = `${url.protocol}//${url.host}`;
  return { ok: true, normalized };
}

/**
 * Block obvious local/private/reserved hostnames and IP literals.
 *
 * This is a literal-string / IP-range check only. DNS-level rebinding is
 * defended by `assertSafeResolvedHost`, which resolves the hostname at
 * request time and re-checks.
 */
function isBlockedHostLiteral(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname.endsWith('.localhost')) return true;
  if (hostname === 'metadata.google.internal') return true;
  if (hostname.endsWith('.internal')) return true;
  if (hostname.endsWith('.local')) return true;

  const ipVersion = isIP(hostname);
  if (ipVersion === 0) return false;
  return isReservedIp(hostname, ipVersion);
}

/**
 * Returns true when the given IP literal falls in a reserved/private/
 * link-local/loopback range that must not be reachable from user settings.
 */
function isReservedIp(ip: string, version: number): boolean {
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true;                        // 0.0.0.0/8
    if (a === 10) return true;                       // 10.0.0.0/8 (RFC1918)
    if (a === 127) return true;                      // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;         // 169.254.0.0/16 link-local (AWS/GCP metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;// 172.16.0.0/12 (RFC1918)
    if (a === 192 && b === 168) return true;         // 192.168.0.0/16 (RFC1918)
    if (a === 192 && b === 0) return true;           // 192.0.0.0/24 reserved
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a >= 224) return true;                       // multicast + reserved
    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true;   // link-local
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;                           // fc00::/7 unique-local
    if (lower.startsWith('ff')) return true;                                     // multicast
    if (lower.startsWith('::ffff:')) {
      // IPv4-mapped IPv6 — extract the v4 portion and recurse
      const v4 = lower.slice(7);
      if (isIP(v4) === 4) return isReservedIp(v4, 4);
    }
    return false;
  }

  return true;
}

/**
 * Runtime DNS check. Call this immediately before issuing an HTTP request
 * to a user-supplied base URL. Closes the DNS-rebinding gap that
 * `validateSafeHttpsUrl` cannot cover on its own.
 *
 * Throws if the hostname resolves to a reserved/private address.
 */
export async function assertSafeResolvedHost(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  const { address, family } = await lookup(url.hostname);
  if (isReservedIp(address, family)) {
    throw new Error(
      `Refusing to connect: ${url.hostname} resolves to a disallowed address (${address})`,
    );
  }
}

// ── class-validator decorator ────────────────────────────────────────────────

@ValidatorConstraint({ name: 'isSafeHttpsUrl', async: false })
class IsSafeHttpsUrlConstraint implements ValidatorConstraintInterface {
  private lastReason = 'URL is not allowed';

  validate(value: unknown): boolean {
    if (value === null || value === undefined || value === '') return true;
    if (typeof value !== 'string') {
      this.lastReason = 'URL must be a string';
      return false;
    }
    const result = validateSafeHttpsUrl(value);
    if (result.ok === false) {
      this.lastReason = result.reason;
      return false;
    }
    return true;
  }

  defaultMessage(): string {
    return this.lastReason;
  }
}

export function IsSafeHttpsUrl(validationOptions?: ValidationOptions): PropertyDecorator {
  return function (object, propertyName) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [],
      validator: IsSafeHttpsUrlConstraint,
    });
  };
}
