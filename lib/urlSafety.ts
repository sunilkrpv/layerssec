/**
 * Frontend mirror of `layers-rest/src/common/url-safety.ts`.
 *
 * Used for inline validation of the OpenAI "Custom API base URL" in AI Settings.
 * The backend re-validates on write (DTO decorator + service) — this is purely
 * a UX layer so users see the problem before submitting.
 *
 * Rules (must match backend):
 *   1. https:// only
 *   2. no userinfo (user:password@)
 *   3. no query, fragment, or non-root path
 *   4. non-default ports below 1024 are rejected (443 is allowed)
 *   5. length <= 256 chars
 *   6. host is not localhost / *.local / *.internal / cloud metadata host
 *   7. host is not a private / reserved / link-local / loopback IP literal
 *
 * Note: frontend cannot do DNS lookups, so DNS-rebinding is defended only
 * server-side (see `assertSafeResolvedHost`).
 */

const MAX_URL_LENGTH = 256;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export type UrlValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

export function validateSafeHttpsUrl(raw: string): UrlValidation {
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

function isBlockedHostLiteral(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname.endsWith('.localhost')) return true;
  if (hostname === 'metadata.google.internal') return true;
  if (hostname.endsWith('.internal')) return true;
  if (hostname.endsWith('.local')) return true;

  const v4 = parseIPv4(hostname);
  if (v4) return isReservedIPv4(v4);

  if (hostname.includes(':')) {
    return isReservedIPv6(hostname);
  }

  return false;
}

function parseIPv4(host: string): [number, number, number, number] | null {
  const m = IPV4_RE.exec(host);
  if (!m) return null;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as const;
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

function isReservedIPv4([a, b]: [number, number, number, number]): boolean {
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isReservedIPv6(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe80::')) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
  if (lower.startsWith('ff')) return true;
  if (lower.startsWith('::ffff:')) {
    const v4part = lower.slice(7);
    const v4 = parseIPv4(v4part);
    if (v4) return isReservedIPv4(v4);
  }
  return true;
}
