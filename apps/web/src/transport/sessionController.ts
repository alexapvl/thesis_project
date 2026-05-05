import { useStore } from '@/store';
import { CANONICAL_CHUNK_SIZE } from '@/audio/types';
import type { SourceMode } from '@stl/protocol';
import { TransportClient } from './client';
import { routeDownstream } from './router';
import {
  buildAudioChunk,
  buildClientPing,
  buildSessionInit,
  buildSessionSeek,
  buildSessionStop,
} from './serializers';
import type { TransportEvent } from './types';

type ActiveSession = {
  id: string;
  mode: SourceMode;
};

function defaultUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

class SessionController {
  private client: TransportClient | null = null;
  private session: ActiveSession | null = null;
  private sequence = 0;
  private pingTimer: number | null = null;
  private lastPingSentAtMs: number | null = null;
  private unsubEvents: (() => void) | null = null;

  /** Start the WebSocket connection. Idempotent. */
  boot(url: string = defaultUrl()): void {
    if (this.client) return;
    const client = new TransportClient({ url });
    this.client = client;
    this.unsubEvents = client.on((e) => this.handleEvent(e));
    client.connect();
  }

  shutdown(): void {
    this.stopSession();
    if (this.pingTimer != null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    this.unsubEvents?.();
    this.unsubEvents = null;
    this.client?.close();
    this.client = null;
  }

  /**
   * Start a session for the given source mode. Caller is responsible for
   * stopping the previous session if the mode changes; we send a fresh
   * session.init either way so the backend can reset state.
   */
  startSession(mode: SourceMode, fileMetadata?: { fileName: string; durationMs: number | null }): void {
    if (!this.client) return;
    if (this.session) this.stopSession();
    const id = crypto.randomUUID();
    this.session = { id, mode };
    this.sequence = 0;
    if (this.client.getStatus() !== 'connected') {
      // session.init will be re-attempted once the socket comes up; for now
      // just remember the intent — sendChunk will no-op until connected.
      return;
    }
    this.client.send(
      buildSessionInit({
        sessionId: id,
        sequence: this.nextSeq(),
        sourceMode: mode,
        chunkSize: CANONICAL_CHUNK_SIZE,
        fileMetadata,
      }),
    );
  }

  stopSession(): void {
    if (!this.session || !this.client) {
      this.session = null;
      return;
    }
    if (this.client.getStatus() === 'connected') {
      this.client.send(buildSessionStop({ sessionId: this.session.id, sequence: this.nextSeq() }));
    }
    this.session = null;
    useStore.getState().lightingReset();
    useStore.getState().inferenceSet('idle');
  }

  pushChunk(pcm: Float32Array, playbackPositionMs: number | null): void {
    if (!this.session || !this.client) return;
    if (this.client.getStatus() !== 'connected') return;
    this.client.send(
      buildAudioChunk({
        sessionId: this.session.id,
        sequence: this.nextSeq(),
        pcm,
        startOffsetMs: playbackPositionMs,
        playbackPositionMs,
      }),
    );
  }

  seek(newPositionMs: number): void {
    if (!this.session || !this.client) return;
    if (this.client.getStatus() !== 'connected') return;
    this.client.send(
      buildSessionSeek({
        sessionId: this.session.id,
        sequence: this.nextSeq(),
        newPositionMs,
        resetInference: true,
        sourceMode: this.session.mode,
      }),
    );
    useStore.getState().lightingReset();
  }

  hasActiveSession(): boolean {
    return this.session != null;
  }

  private nextSeq(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private handleEvent(e: TransportEvent): void {
    const store = useStore.getState();
    if (e.kind === 'status') {
      store.transportSet(e.status, e.error ?? null);
      if (e.status === 'connected') {
        // Re-issue session.init if a session was requested while disconnected.
        if (this.session) {
          this.client?.send(
            buildSessionInit({
              sessionId: this.session.id,
              sequence: this.nextSeq(),
              sourceMode: this.session.mode,
              chunkSize: CANONICAL_CHUNK_SIZE,
            }),
          );
        }
        this.startPingLoop();
      } else {
        this.stopPingLoop();
        store.transportSetLatency(null);
      }
      return;
    }
    if (e.kind === 'parseError') {
      store.debugLog('warn', `transport parse error: ${e.error}`);
      return;
    }
    routeDownstream(e.message, {
      'session.ready': (msg) => {
        store.debugLog('info', `session.ready (proto ${msg.protocolVersion})`);
        store.inferenceSet('idle');
      },
      'beat.update': (msg) => {
        store.lightingApply({
          lastBeatTimeMs: msg.beatTimeMs,
          confidence: msg.confidence,
          lastUpdateTimeMs: Date.now(),
        });
      },
      'tempo.update': (msg) => {
        store.lightingApply({ bpm: msg.bpm, lastUpdateTimeMs: Date.now() });
      },
      'lighting.update': (msg) => {
        store.lightingApply({
          hue: msg.hue,
          value: msg.value,
          confidence: msg.confidence,
          lastUpdateTimeMs: Date.now(),
        });
      },
      'inference.status': (msg) => {
        store.inferenceSet(msg.state, msg.detail);
      },
      'server.error': (msg) => {
        store.debugLog('error', `server ${msg.code}: ${msg.message}`);
        store.transportSet(this.client?.getStatus() ?? 'error', msg.message);
      },
      'server.pong': () => {
        if (this.lastPingSentAtMs != null) {
          store.transportSetLatency(Date.now() - this.lastPingSentAtMs);
          this.lastPingSentAtMs = null;
        }
      },
    });
  }

  private startPingLoop(): void {
    if (this.pingTimer != null) return;
    this.pingTimer = window.setInterval(() => this.sendPing(), 5000);
  }

  private stopPingLoop(): void {
    if (this.pingTimer == null) return;
    window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.lastPingSentAtMs = null;
  }

  private sendPing(): void {
    if (!this.client || this.client.getStatus() !== 'connected') return;
    const sessionId = this.session?.id ?? 'no-session';
    this.lastPingSentAtMs = Date.now();
    this.client.send(buildClientPing({ sessionId, sequence: this.nextSeq() }));
  }
}

export const sessionController = new SessionController();
