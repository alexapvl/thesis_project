import type { DownstreamMessage } from '@stl/protocol';

export type TransportStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type TransportEvent =
  | { kind: 'status'; status: TransportStatus; error?: string | null }
  | { kind: 'message'; message: DownstreamMessage }
  | { kind: 'parseError'; error: string };

export type TransportClientOptions = {
  url: string;
  pingIntervalMs?: number;
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
};
