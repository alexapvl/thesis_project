/**
 * Protocol version follows semver. Bump rules:
 *  - patch: doc-only or non-observable change.
 *  - minor: additive — new optional field or new message type. Old clients keep working.
 *  - major: breaking — removed/renamed field, removed message, type change.
 *
 * Both sides MUST send the version string in the envelope. The server compares
 * major versions on `session.init`; on mismatch it sends `server.error`
 * (`code: protocol.versionMismatch`) and closes the session.
 */
export const PROTOCOL_VERSION = '1.0.0' as const;

export const CANONICAL_SAMPLE_RATE = 48000 as const;
export const CANONICAL_CHANNELS = 1 as const;

export function parseSemverMajor(version: string): number {
  const [major] = version.split('.');
  const n = Number(major);
  if (!Number.isFinite(n)) {
    throw new Error(`invalid protocol version: ${version}`);
  }
  return n;
}

export function isMajorCompatible(a: string, b: string): boolean {
  return parseSemverMajor(a) === parseSemverMajor(b);
}
