import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import WebSocket from 'ws';
import { AI_TTS_STREAM_EVENT, type AiTtsStreamEvent } from '../../common/stream-events';

type ClientSession = {
  sessionId: string;
  clientWs: WebSocket;
  tencentWs?: WebSocket;
  ready: boolean;
  pendingChunks: string[];
  closed: boolean;
};

@Injectable()
export class TtsRelayService implements OnModuleDestroy {
  private readonly logger = new Logger(TtsRelayService.name);
  private readonly sessions = new Map<string, ClientSession>();

  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly appId: string;
  private readonly voiceType: number;

  constructor(private readonly configService: ConfigService) {
    this.secretId = this.configService.get<string>('TENCENT_SECRET_ID', '');
    this.secretKey = this.configService.get<string>('TENCENT_SECRET_KEY', '');
    this.appId = this.configService.get<string>('TENCENT_APP_ID', '');
    this.voiceType = parseInt(this.configService.get<string>('TTS_VOICE_TYPE', '502006'), 10);
  }

  registerClient(clientWs: WebSocket, wantedSessionId?: string): string {
    const sessionId = wantedSessionId?.trim() || randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      clientWs,
      ready: false,
      pendingChunks: [],
      closed: false,
    });
    clientWs.send(JSON.stringify({ type: 'session', sessionId }));
    this.logger.log(`TTS client registered: ${sessionId.substring(0, 8)}...`);
    return sessionId;
  }

  unregisterClient(sessionId: string): void {
    this.closeSession(sessionId, 'client disconnected');
  }

  @OnEvent(AI_TTS_STREAM_EVENT)
  handleAiStreamEvent(event: AiTtsStreamEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session || session.closed) return;

    switch (event.type) {
      case 'start':
        this.ensureTencentConnection(session);
        session.clientWs.send(JSON.stringify({ type: 'tts_started', sessionId: event.sessionId }));
        break;
      case 'chunk':
        if (!session.ready) {
          session.pendingChunks.push(event.chunk);
        } else {
          this.sendTencentChunk(session, event.chunk);
        }
        break;
      case 'end':
        this.flushPendingChunks(session);
        if (session.tencentWs && session.tencentWs.readyState === WebSocket.OPEN) {
          session.tencentWs.send(JSON.stringify({
            session_id: session.sessionId,
            action: 'ACTION_COMPLETE',
          }));
        }
        break;
      case 'error':
        this.closeSession(session.sessionId, `ai stream error: ${event.error}`);
        break;
    }
  }

  onModuleDestroy(): void {
    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId, 'module destroy');
    }
  }

  private ensureTencentConnection(session: ClientSession): void {
    if (!this.secretId || !this.secretKey || !this.appId) {
      this.logger.warn('TTS credentials not configured, skipping TTS connection');
      session.clientWs.send(JSON.stringify({ type: 'tts_error', message: 'TTS 未配置' }));
      return;
    }

    const url = this.buildTencentTtsWsUrl(session.sessionId);
    const tencentWs = new WebSocket(url);
    session.tencentWs = tencentWs;

    tencentWs.on('open', () => {
      this.logger.log(`Tencent TTS connected for session ${session.sessionId.substring(0, 8)}...`);
    });

    tencentWs.on('message', (data, isBinary) => {
      if (session.closed) return;

      if (isBinary) {
        if (session.clientWs.readyState === WebSocket.OPEN) {
          session.clientWs.send(data, { binary: true });
        }
        return;
      }

      try {
        const msg = JSON.parse(data.toString());
        if (Number(msg.ready) === 1) {
          session.ready = true;
          this.flushPendingChunks(session);
        }
        if (Number(msg.final) === 1) {
          if (session.clientWs.readyState === WebSocket.OPEN) {
            session.clientWs.send(JSON.stringify({ type: 'tts_final' }));
          }
        }
        if (msg.code && msg.code !== 0 && msg.message) {
          this.logger.error(`TTS error: ${msg.code} ${msg.message}`);
          session.clientWs.send(JSON.stringify({ type: 'tts_error', message: msg.message }));
        }
      } catch {
        // non-JSON text frame, ignore
      }
    });

    tencentWs.on('error', (err) => {
      this.logger.error(`Tencent TTS WebSocket error: ${err.message}`);
      if (session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({ type: 'tts_error', message: 'TTS 连接失败' }));
      }
    });

    tencentWs.on('close', () => {
      this.logger.log(`Tencent TTS disconnected for session ${session.sessionId.substring(0, 8)}...`);
      session.tencentWs = undefined;
      session.ready = false;
    });
  }

  private sendTencentChunk(session: ClientSession, text: string): void {
    if (!session.tencentWs || session.tencentWs.readyState !== WebSocket.OPEN) return;

    session.tencentWs.send(JSON.stringify({
      session_id: session.sessionId,
      message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action: 'ACTION_SYNTHESIS',
      data: text,
    }));
  }

  private flushPendingChunks(session: ClientSession): void {
    if (!session.ready || session.pendingChunks.length === 0) return;

    const chunks = session.pendingChunks.splice(0);
    const combined = chunks.join('');
    if (combined) {
      this.sendTencentChunk(session, combined);
    }
  }

  private closeSession(sessionId: string, reason: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.closed) return;

    session.closed = true;

    if (session.tencentWs) {
      try { session.tencentWs.close(); } catch { /* ignore */ }
    }
    if (session.clientWs.readyState === WebSocket.OPEN) {
      try {
        session.clientWs.send(JSON.stringify({ type: 'tts_closed', reason }));
        session.clientWs.close();
      } catch { /* ignore */ }
    }

    this.sessions.delete(sessionId);
    this.logger.log(`TTS session closed: ${sessionId.substring(0, 8)}... (${reason})`);
  }

  private buildTencentTtsWsUrl(sessionId: string): string {
    const now = Math.floor(Date.now() / 1000);
    const params: Record<string, string | number> = {
      Action: 'TextToStreamAudioWSv2',
      AppId: parseInt(this.appId, 10),
      Codec: 'mp3',
      Expired: now + 3600,
      SampleRate: 16000,
      SecretId: this.secretId,
      SessionId: sessionId,
      Speed: 0,
      Timestamp: now,
      VoiceType: this.voiceType,
      Volume: 5,
    };

    const signStr = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');

    const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`;
    const signature = createHmac('sha1', this.secretKey).update(rawStr).digest('base64');

    const searchParams = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
      Signature: signature,
    });

    return `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`;
  }
}
