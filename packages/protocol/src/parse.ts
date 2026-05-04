import { downstreamMessageSchema, upstreamMessageSchema } from './messages';
import type { DownstreamMessage, UpstreamMessage } from './messages';

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function parseUpstream(raw: unknown): ParseResult<UpstreamMessage> {
  const result = upstreamMessageSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.message };
}

export function parseDownstream(raw: unknown): ParseResult<DownstreamMessage> {
  const result = downstreamMessageSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, error: result.error.message };
}