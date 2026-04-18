# 语音功能实现文档

基于 `asr-and-tts-nest-service` 项目，整理所有语音相关功能的完整实现方案，供其他项目复用。

---

## 功能清单

| 功能 | 技术方案 | 云服务 | 传输方式 |
|------|---------|--------|---------|
| ASR 语音识别 | 腾讯云一句话识别 | 腾讯云 ASR | HTTP POST + FormData |
| TTS 流式语音合成 | 腾讯云流式合成 v2 | 腾讯云 TTS | 双向 WebSocket 中继 |
| AI + TTS 联动 | LangChain 流式 + 事件总线 | 阿里云 DashScope | SSE + EventEmitter |

---

## 一、ASR 语音识别（一句话识别）

### 1.1 原理

前端通过 `MediaRecorder` 录制音频，以 FormData 形式 POST 到后端。后端将音频 Base64 编码后调用腾讯云 `SentenceRecognition` API，返回识别文本。

### 1.2 环境变量

```env
SECRET_ID=你的腾讯云 SecretId
SECRET_KEY=你的腾讯云 SecretKey
```

### 1.3 依赖安装

```bash
pnpm add tencentcloud-sdk-nodejs @nestjs/config @nestjs/platform-express
```

> `FileInterceptor` 来自 `@nestjs/platform-express`，不是 `@nestjs/common`，必须单独安装。

### 1.4 后端实现

**SpeechModule — 完整模块定义**

```typescript
// speech/speech.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';
import { TtsRelayService } from './tts-relay.service';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

const AsrClient = tencentcloud.asr.v20190614.Client;

@Module({
  controllers: [SpeechController],
  providers: [
    SpeechService,   // ASR 语音识别服务
    TtsRelayService, // TTS 流式语音合成中继服务
    {
      provide: 'ASR_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new AsrClient({
          credential: {
            secretId: configService.get<string>('SECRET_ID'),
            secretKey: configService.get<string>('SECRET_KEY'),
          },
          region: 'ap-shanghai',
          profile: {
            httpProfile: { reqMethod: 'POST', reqTimeout: 30 },
          },
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [TtsRelayService], // 导出给 main.ts 中 WebSocket 使用
})
export class SpeechModule {}
```

**SpeechService — 调用一句话识别**

```typescript
// speech/speech.service.ts
import { Inject, Injectable } from '@nestjs/common';
import type * as tencentcloud from 'tencentcloud-sdk-nodejs';

type AsrClient = InstanceType<typeof tencentcloud.asr.v20190614.Client>;

@Injectable()
export class SpeechService {
  constructor(@Inject('ASR_CLIENT') private readonly asrClient: AsrClient) {}

  async recognizeBySentence(file: { buffer: Buffer }): Promise<string> {
    const audioBase64 = file.buffer.toString('base64');
    const result = await this.asrClient.SentenceRecognition({
      EngSerViceType: '16k_zh',  // 16k 中文引擎
      SourceType: 1,               // 音频来源为直接上传 Base64
      Data: audioBase64,
      DataLen: file.buffer.length,
      VoiceFormat: 'ogg-opus',     // 匹配前端录音格式
    });
    return result.Result ?? '';
  }
}
```

**SpeechController — 接收音频文件**

```typescript
// speech/speech.controller.ts
import {
  BadRequestException, Controller, Post,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';

@Controller('speech')
export class SpeechController {
  constructor(private readonly speechService: SpeechService) {}

  @Post('asr')
  @UseInterceptors(FileInterceptor('audio'))
  async recognize(@UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请通过 FormData 的 audio 字段上传音频文件');
    }
    const text = await this.speechService.recognizeBySentence(file);
    return { text };
  }
}
```

> `FileInterceptor('audio')` 中的 `'audio'` 对应前端 FormData 字段名。

### 1.5 前端实现

```javascript
// 录音
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const preferredMimeType = 'audio/ogg;codecs=opus';
const mediaRecorder = MediaRecorder.isTypeSupported(preferredMimeType)
  ? new MediaRecorder(stream, { mimeType: preferredMimeType })
  : new MediaRecorder(stream);

const chunks = [];
mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) chunks.push(e.data);
};

mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', blob, 'record.ogg');  // 字段名必须与后端一致

  const response = await fetch('/speech/asr', { method: 'POST', body: formData });
  const data = await response.json();
  // data.text 即识别结果
};

mediaRecorder.start(250);  // 每 250ms 触发一次 ondataavailable
```

### 1.6 关键参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `EngSerViceType` | `16k_zh` | 16kHz 中文引擎，支持中英混合 |
| `SourceType` | `1` | 音频数据以 Base64 直接上传 |
| `VoiceFormat` | `ogg-opus` | 匹配浏览器 MediaRecorder 默认格式 |
| `region` | `ap-shanghai` | 腾讯云 ASR 服务区域 |

---

## 二、TTS 流式语音合成（WebSocket 双向中继）

### 2.1 原理

```
前端 (浏览器)                      本服务                       腾讯 TTS
┌──────────┐   WebSocket      ┌──────────────┐   WebSocket   ┌───────────┐
│ 播放音频  │◄───────────────►│ TtsRelayService│◄────────────►│ 流式语音合成 │
└──────────┘  音频(binary)    └──────────────┘  文本→音频     └───────────┘
```

本服务作为中间代理，建立两条 WebSocket：
- **前端 WS**：路径 `/speech/tts/ws`，接收前端连接
- **腾讯 TTS WS**：`wss://tts.cloud.tencent.com/stream_wsv2`，连接腾讯 TTS 服务

AI 每输出一段文本 → 通过 EventEmitter 广播 → TtsRelayService 收到后转发给腾讯 TTS → 腾讯返回音频二进制帧 → 直接透传给前端播放。

### 2.2 环境变量

```env
SECRET_ID=你的腾讯云 SecretId
SECRET_KEY=你的腾讯云 SecretKey
APP_ID=你的腾讯云 AppId
TTS_VOICE_TYPE=502006   # 音色 ID
```

### 2.3 额外依赖

```bash
pnpm add ws @nestjs/event-emitter
pnpm add -D @types/ws
```

### 2.4 后端实现

**事件类型定义**

```typescript
// common/stream-events.ts
export const AI_TTS_STREAM_EVENT = 'ai.tts.stream';

export type AiTtsStreamEvent =
  | { type: 'start'; sessionId: string; query: string }
  | { type: 'chunk'; sessionId: string; chunk: string }
  | { type: 'end'; sessionId: string }
  | { type: 'error'; sessionId: string; error: string };
```

**会话数据结构**

```typescript
type ClientSession = {
  sessionId: string;
  clientWs: WebSocket;        // 前端 WebSocket 连接
  tencentWs?: WebSocket;      // 腾讯 TTS WebSocket 连接
  ready: boolean;             // 腾讯 TTS 是否就绪（收到 ready=1）
  pendingChunks: string[];    // 腾讯未就绪时暂存的文本片段
  closed: boolean;
};
```

**TtsRelayService 核心逻辑**

```typescript
@Injectable()
export class TtsRelayService implements OnModuleDestroy {
  private readonly sessions = new Map<string, ClientSession>();

  // 1. 注册前端客户端
  registerClient(clientWs: WebSocket, wantedSessionId?: string): string {
    const sessionId = wantedSessionId?.trim() || randomUUID();
    this.sessions.set(sessionId, {
      sessionId, clientWs, ready: false, pendingChunks: [], closed: false,
    });
    // 下发 sessionId 给前端
    clientWs.send(JSON.stringify({ type: 'session', sessionId }));
    return sessionId;
  }

  // 2. 注销前端客户端
  unregisterClient(sessionId: string): void {
    this.closeSession(sessionId, 'client disconnected');
  }

  // 3. 监听 AI 流式事件（核心）
  @OnEvent(AI_TTS_STREAM_EVENT)
  handleAiStreamEvent(event: AiTtsStreamEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;

    switch (event.type) {
      case 'start':
        this.ensureTencentConnection(session);  // 建立腾讯 TTS WS
        break;
      case 'chunk':
        if (!session.ready) {
          session.pendingChunks.push(event.chunk);  // 暂存
        } else {
          this.sendTencentChunk(session, event.chunk);  // 发给腾讯
        }
        break;
      case 'end':
        this.flushPendingChunks(session);
        // 通知腾讯 TTS 所有文本已发送
        session.tencentWs?.send(JSON.stringify({
          session_id: session.sessionId,
          action: 'ACTION_COMPLETE',
        }));
        break;
      case 'error':
        this.closeSession(session.sessionId, 'ai stream error');
        break;
    }
  }
}
```

**建立腾讯 TTS WebSocket 连接**

```typescript
private ensureTencentConnection(session: ClientSession): void {
  const url = this.buildTencentTtsWsUrl(session.sessionId);
  const tencentWs = new WebSocket(url);
  session.tencentWs = tencentWs;

  tencentWs.on('message', (data, isBinary) => {
    if (isBinary) {
      // 二进制帧 = 音频数据 → 直接透传给前端
      session.clientWs.send(data, { binary: true });
      return;
    }
    // JSON 帧 = 控制消息
    const msg = JSON.parse(data.toString());
    if (Number(msg.ready) === 1) {
      session.ready = true;
      this.flushPendingChunks(session);  // 刷新暂存文本
    }
    if (Number(msg.final) === 1) {
      session.clientWs.send(JSON.stringify({ type: 'tts_final' }));
    }
  });
}
```

**发送文本给腾讯 TTS**

```typescript
private sendTencentChunk(session: ClientSession, text: string): void {
  session.tencentWs.send(JSON.stringify({
    session_id: session.sessionId,
    message_id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: 'ACTION_SYNTHESIS',
    data: text,
  }));
}
```

**腾讯 TTS WebSocket URL 签名（HMAC-SHA1 鉴权）**

签名流程：
1. 参数按 key 字母序排序拼接成 `key1=val1&key2=val2&...`
2. 构造签名原文：`GET` + 域名 + `?` + 排序参数串
3. 用 SecretKey 对签名原文做 HMAC-SHA1，结果 Base64 编码

```typescript
private buildTencentTtsWsUrl(sessionId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    Action: 'TextToStreamAudioWSv2',
    AppId: this.appId,
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

  // 步骤 1：参数按 key 排序拼接
  const signStr = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  // 步骤 2：构造签名原文（请求方法 + 域名 + 排序参数）
  const rawStr = `GETtts.cloud.tencent.com/stream_wsv2?${signStr}`;

  // 步骤 3：HMAC-SHA1 签名 + Base64 编码
  const signature = createHmac('sha1', this.secretKey).update(rawStr).digest('base64');

  // 用 URLSearchParams 重新构建完整查询串（包含 Signature）
  const searchParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    Signature: signature,
  });

  return `wss://tts.cloud.tencent.com/stream_wsv2?${searchParams.toString()}`;
}
```

**main.ts 注册 WebSocket Server**

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebSocketServer } from 'ws';
import { TtsRelayService } from './speech/tts-relay.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const ttsRelayService = app.get(TtsRelayService);
  const server = app.getHttpServer();

  // 创建 TTS WebSocket 服务，监听 /speech/tts/ws 路径
  const ttsWss = new WebSocketServer({ server, path: '/speech/tts/ws' });
  ttsWss.on('connection', (socket, request) => {
    const reqUrl = new URL(request.url ?? '', 'http://localhost');
    const wantedSessionId = reqUrl.searchParams.get('sessionId') ?? undefined;
    const sessionId = ttsRelayService.registerClient(socket, wantedSessionId);
    socket.on('close', () => ttsRelayService.unregisterClient(sessionId));
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

> 注意：WebSocket Server 挂载在 NestJS 底层 HTTP Server 上，不需要额外安装 `@nestjs/websockets`。

### 2.5 前端实现（流式音频播放）

前端使用 **MediaSource API** 实现流式播放，边收音频边播放：

```javascript
let ttsWs = null;
let ttsSessionId = null;
let ttsMediaSource = null;
let ttsSourceBuffer = null;
let ttsPendingBuffers = [];

// 1. 建立 TTS WebSocket 连接
function ensureTtsConnection() {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${location.host}/speech/tts/ws`);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'session') {
          ttsSessionId = msg.sessionId;
          resolve();
        } else if (msg.type === 'tts_started') {
          prepareStreamingAudio();  // 初始化 MediaSource
        } else if (msg.type === 'tts_final') {
          ttsStreamFinal = true;
          flushTtsBufferQueue();
        }
      } else if (event.data instanceof ArrayBuffer) {
        ttsPendingBuffers.push(event.data);  // 缓存音频帧
        flushTtsBufferQueue();
      }
    };

    ttsWs = ws;
  });
}

// 2. 初始化流式音频播放器
function prepareStreamingAudio() {
  ttsMediaSource = new MediaSource();
  audioEl.src = URL.createObjectURL(ttsMediaSource);

  ttsMediaSource.addEventListener('sourceopen', () => {
    ttsSourceBuffer = ttsMediaSource.addSourceBuffer('audio/mpeg');
    ttsSourceBuffer.mode = 'sequence';
    ttsSourceBuffer.addEventListener('updateend', flushTtsBufferQueue);
  });
}

// 3. 逐帧写入音频缓冲区
function flushTtsBufferQueue() {
  if (!ttsSourceBuffer || ttsSourceBuffer.updating) return;

  if (ttsPendingBuffers.length > 0) {
    const next = ttsPendingBuffers.shift();
    ttsSourceBuffer.appendBuffer(next);
    audioEl.play().catch(() => {});  // 静默处理自动播放限制
    return;
  }

  // 所有音频接收完毕
  if (ttsStreamFinal && ttsMediaSource.readyState === 'open') {
    ttsMediaSource.endOfStream();
  }
}
```

### 2.6 TTS WebSocket 通信协议

**前端 → 后端（控制消息）**

| 消息 | 方向 | 说明 |
|------|------|------|
| 连接 `/speech/tts/ws` | 前端 → 后端 | 建立 WebSocket |
| `{ type: 'session', sessionId }` | 后端 → 前端 | 下发 sessionId |
| `{ type: 'tts_started', sessionId }` | 后端 → 前端 | TTS 合成开始 |
| **Binary 帧** | 后端 → 前端 | 音频数据，直接透传 |
| `{ type: 'tts_final' }` | 后端 → 前端 | 整段合成完毕 |
| `{ type: 'tts_error', message }` | 后端 → 前端 | 出错通知 |
| `{ type: 'tts_closed', reason }` | 后端 → 前端 | 会话关闭 |

**后端 → 腾讯 TTS（合成控制）**

| 消息 | 说明 |
|------|------|
| `{ action: 'ACTION_SYNTHESIS', data: '文本' }` | 发送一段文本进行合成 |
| `{ action: 'ACTION_COMPLETE' }` | 所有文本已发送，通知完成 |

---

## 三、AI 流式对话 + TTS 联动

### 3.1 原理

AI 流式输出文本时，同时通过事件总线（EventEmitter）将每个文本片段广播给 TTS 服务，实现「边生成文本、边语音合成」的实时效果。

```
AI Service (LangChain stream)
    │
    ├── SSE → 前端（文字流式显示）
    │
    └── EventEmitter → TtsRelayService → 腾讯 TTS → 前端（语音流式播放）
```

### 3.2 环境变量

```env
OPENAI_API_KEY=sk-xx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen-plus
```

### 3.3 依赖安装

```bash
pnpm add @langchain/core @langchain/openai @nestjs/event-emitter rxjs
```

### 3.4 后端实现

**AiModule — 注册 LLM Provider**

```typescript
// ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        return new ChatOpenAI({
          model: configService.get('MODEL_NAME'),
          apiKey: configService.get('OPENAI_API_KEY'),
          configuration: {
            baseURL: configService.get('OPENAI_BASE_URL'),
          },
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AiModule {}
```

**AppModule 注册 EventEmitter 和 AiModule**

```typescript
// app.module.ts 关键 imports
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  EventEmitterModule.forRoot({ maxListeners: 200 }),
  AiModule,
  SpeechModule,
]
```

**AiService — 流式生成 + 广播事件**

```typescript
// ai/ai.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import type { Runnable } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, type AiTtsStreamEvent } from '../common/stream-events';

@Injectable()
export class AiService {
  private readonly chain: Runnable;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const prompt = PromptTemplate.fromTemplate('请回答以下问题：\n\n{query}');
    this.chain = prompt.pipe(model).pipe(new StringOutputParser());
  }

  async *streamChain(query: string, ttsSessionId?: string): AsyncGenerator<string> {
    try {
      const stream = await this.chain.stream({ query });
      for await (const chunk of stream) {
        if (ttsSessionId) {
          this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
            type: 'chunk', sessionId: ttsSessionId, chunk,
          });
        }
        yield chunk;
      }
      if (ttsSessionId) {
        this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
          type: 'end', sessionId: ttsSessionId,
        });
      }
    } catch (error) {
      if (ttsSessionId) {
        this.eventEmitter.emit(AI_TTS_STREAM_EVENT, {
          type: 'error', sessionId: ttsSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }
}
```

**AiController — SSE 端点**

```typescript
// ai/ai.controller.ts
import { Controller, Get, Query, Sse } from '@nestjs/common';
import { from, map, Observable } from 'rxjs';
import { AiService } from './ai.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AI_TTS_STREAM_EVENT, type AiTtsStreamEvent } from '../common/stream-events';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('chat/stream')
  chatStream(
    @Query('query') query: string,
    @Query('ttsSessionId') ttsSessionId?: string,
  ): Observable<{ data: string }> {
    if (ttsSessionId) {
      const startEvent: AiTtsStreamEvent = { type: 'start', sessionId: ttsSessionId, query };
      this.eventEmitter.emit(AI_TTS_STREAM_EVENT, startEvent);
    }
    return from(this.aiService.streamChain(query, ttsSessionId)).pipe(
      map((chunk) => ({ data: chunk })),
    );
  }
}
```

### 3.5 前端调用

```javascript
// 1. 先建立 TTS 连接
await ensureTtsConnection();

// 2. 请求 AI 流式回复，带上 ttsSessionId 实现联动
const url = `/ai/chat/stream?query=${encodeURIComponent(query)}` +
  (ttsSessionId ? `&ttsSessionId=${encodeURIComponent(ttsSessionId)}` : '');

const es = new EventSource(url);
es.onmessage = (event) => {
  // event.data = AI 输出的文本片段，追加显示
};
es.onerror = () => es.close();
```

---

## 四、完整数据流时序

```
前端                          后端                              腾讯云
 │                             │                                 │
 │  POST /speech/asr           │                                 │
 │  (音频 FormData)            │                                 │
 │────────────────────────────►│  SentenceRecognition()          │
 │                             │────────────────────────────────►│
 │  { text: "你好" }           │                                 │
 │◄────────────────────────────│◄────────────────────────────────│
 │                             │                                 │
 │  WS /speech/tts/ws          │                                 │
 │────────────────────────────►│  registerClient()               │
 │  { type:'session', id }     │                                 │
 │◄────────────────────────────│                                 │
 │                             │                                 │
 │  GET /ai/chat/stream        │                                 │
 │  ?query=你好&ttsSessionId=x │                                 │
 │────────────────────────────►│                                 │
 │                             │  emit('start')                  │
 │                             │─────────► ensureTencentConn()   │
 │                             │          建立腾讯 TTS WS         │
 │                             │────────────────────────────────►│
 │                             │                                 │
 │  SSE: "你"                  │  emit('chunk', '你')            │
 │◄────────────────────────────│─────────► ACTION_SYNTHESIS      │
 │                             │────────────────────────────────►│
 │  Binary: 音频帧             │  Binary 帧透传                  │
 │◄────────────────────────────│◄────────────────────────────────│
 │                             │                                 │
 │  SSE: "好！"                │  emit('chunk', '好！')          │
 │◄────────────────────────────│─────────► ACTION_SYNTHESIS      │
 │                             │────────────────────────────────►│
 │  Binary: 音频帧             │                                 │
 │◄────────────────────────────│◄────────────────────────────────│
 │                             │                                 │
 │  SSE closed                 │  emit('end')                    │
 │◄────────────────────────────│─────────► ACTION_COMPLETE       │
 │                             │────────────────────────────────►│
 │  { type:'tts_final' }      │                                 │
 │◄────────────────────────────│◄────────────────────────────────│
```

---

## 五、移植到其他项目 Checklist

### 按功能选配文件

**仅 ASR 语音识别（最精简）：**

- [ ] `speech/speech.module.ts` — 模块定义 + ASR Client Provider
- [ ] `speech/speech.controller.ts` — `/speech/asr` 接口
- [ ] `speech/speech.service.ts` — ASR 服务逻辑

**ASR + TTS 流式合成：**

- [ ] 以上 3 个文件
- [ ] `speech/tts-relay.service.ts` — TTS WebSocket 中继服务
- [ ] `common/stream-events.ts` — 事件类型定义
- [ ] `main.ts` 中添加 WebSocket Server 注册（`WebSocketServer` from `ws`）

**ASR + TTS + AI 联动（完整功能）：**

- [ ] 以上所有文件
- [ ] `ai/ai.module.ts` — AI 模块 + LLM Provider
- [ ] `ai/ai.service.ts` — 流式生成 + 事件广播
- [ ] `ai/ai.controller.ts` — SSE 端点 `/ai/chat/stream`

### AppModule 配置

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SpeechModule } from './speech/speech.module';
import { AiModule } from './ai/ai.module'; // 仅 AI 联动时需要

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot({ maxListeners: 200 }), // TTS 事件总线必需
    SpeechModule,
    AiModule, // 仅 AI 联动时需要
  ],
})
export class AppModule {}
```

### 环境变量

```env
# 腾讯云 ASR + TTS（必需）
SECRET_ID=
SECRET_KEY=
APP_ID=
TTS_VOICE_TYPE=502006

# AI 联动（可选）
OPENAI_API_KEY=
OPENAI_BASE_URL=
MODEL_NAME=
```

### NPM 依赖

**仅 ASR：**

```bash
pnpm add tencentcloud-sdk-nodejs @nestjs/config @nestjs/platform-express
```

**ASR + TTS：**

```bash
pnpm add tencentcloud-sdk-nodejs @nestjs/config @nestjs/platform-express ws @nestjs/event-emitter
pnpm add -D @types/ws
```

**完整功能（ASR + TTS + AI）：**

```bash
pnpm add tencentcloud-sdk-nodejs @nestjs/config @nestjs/platform-express \
  ws @nestjs/event-emitter @langchain/core @langchain/openai rxjs
pnpm add -D @types/ws
```

**完整功能（ASR + TTS + AI）：**
- 待增加模型
- glm-5.1
- qwen3.6-plus-2026-04-02
- glm-5
- MiniMax-M2.1
- glm-4.7
