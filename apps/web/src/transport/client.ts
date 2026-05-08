import { parseDownstream, type UpstreamMessage } from '@stl/protocol';
import type { TransportClientOptions, TransportEvent, TransportStatus } from './types';

/**
 * Thin WebSocket wrapper:
 *  - validates inbound JSON through the protocol package
 *  - exposes status transitions as events
 *  - reconnects with exponential backoff while the user wants the socket open
 *
 * It is intentionally dumb about sessions; the SessionController layer above
 * decides when to (re)issue session.init.
 */
export class TransportClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: TransportEvent) => void>();
  private wantOpen = false;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private status: TransportStatus = 'disconnected';
  private readonly opts: Required<TransportClientOptions>;

  constructor(opts: TransportClientOptions) {
    this.opts = {
      pingIntervalMs: 5000,
      reconnectBaseMs: 500,
      reconnectMaxMs: 8000,
      ...opts,
    };
  }

  on(cb: (e: TransportEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  getStatus(): TransportStatus {
    return this.status;
  }

  connect(): void {
    this.wantOpen = true;
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return;
    this.openSocket();
  }

  close(): void {
    this.wantOpen = false;
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'client closing');
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  send(msg: UpstreamMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private openSocket(): void {
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.opts.url);
    } catch (err) {
      this.setStatus('error', err instanceof Error ? err.message : String(err));
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setStatus('connected');
    };

    ws.onmessage = (ev) => {
      let raw: unknown;
      try {
        raw = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch (err) {
        this.emit({
          kind: 'parseError',
          error: `non-json frame: ${err instanceof Error ? err.message : String(err)}`,
        });
        return;
      }
      const parsed = parseDownstream(raw);
      if (!parsed.ok) {
        this.emit({ kind: 'parseError', error: parsed.error });
        return;
      }
      this.emit({ kind: 'message', message: parsed.value });
    };

    ws.onerror = () => {
      // Browser doesn't expose a useful reason; rely on close handler for state.
      this.setStatus('error', 'websocket error');
    };

    ws.onclose = (ev) => {
      this.ws = null;
      // Surface the close code so we can tell normal closes from abnormal
      // ones (1006 = peer dropped without a close frame, 1011 = server
      // error, 1001 = going away, etc). Without the code in the message,
      // EPIPE / proxy hiccups are indistinguishable from a clean close.
      const tag = `[${ev.code}${ev.wasClean ? ' clean' : ' abnormal'}]`;
      const reason = ev.reason ? `${tag} ${ev.reason}` : tag;
      if (this.wantOpen) {
        this.setStatus('disconnected', reason);
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected', reason);
      }
    };
  }

  private scheduleReconnect(): void {
    if (!this.wantOpen) return;
    if (this.reconnectTimer != null) return;
    const base = this.opts.reconnectBaseMs;
    const max = this.opts.reconnectMaxMs;
    const delay = Math.min(max, base * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wantOpen) this.openSocket();
    }, delay);
  }

  private setStatus(status: TransportStatus, error: string | null = null): void {
    if (this.status === status && error == null) return;
    this.status = status;
    this.emit({ kind: 'status', status, error });
  }

  private emit(event: TransportEvent): void {
    for (const cb of this.listeners) cb(event);
  }
}
