import { ref, onUnmounted } from "vue";

export type SSEEventType =
  | "message_start"
  | "content_delta"
  | "message_done"
  | "done"
  | "error";

export interface SSEEvent {
  event: SSEEventType;
  data: unknown;
}

export interface SSEOptions {
  onMessageStart?: (data: {
    session_id: string;
    message_id: string;
    role: string;
  }) => void;
  onContentDelta?: (data: {
    session_id: string;
    message_id: string;
    content: string;
  }) => void;
  onMessageDone?: (data: {
    session_id: string;
    message_id: string;
    finish_reason: string;
  }) => void;
  onDone?: (data: { session_id: string }) => void;
  onError?: (data: {
    session_id?: string;
    error: string;
    code: string;
  }) => void;
}

/**
 * SSE 连接管理 composable
 */
export function useSSE() {
  const isConnected = ref(false);
  const reader = ref<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const decoder = new TextDecoder();

  /**
   * 解析 SSE 事件
   */
  function parseSSE(text: string): SSEEvent[] {
    const events: SSEEvent[] = [];
    const lines = text.split("\n");

    let currentEvent: string | null = null;
    let currentData: string | null = null;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.substring(6).trim();
      } else if (line.startsWith("data:")) {
        currentData = line.substring(5).trim();
      } else if (line === "" && currentEvent && currentData) {
        try {
          events.push({
            event: currentEvent as SSEEventType,
            data: JSON.parse(currentData),
          });
        } catch {
          // 忽略解析错误
        }
        currentEvent = null;
        currentData = null;
      }
    }

    return events;
  }

  /**
   * 处理 SSE 流
   */
  async function processStream(
    response: Response,
    options: SSEOptions = {},
  ): Promise<void> {
    reader.value = response.body?.getReader() || null;
    if (!reader.value) {
      throw new Error("无法获取响应流");
    }

    isConnected.value = true;
    let buffer = "";
    let doneEventReceived = false;

    try {
      while (true) {
        const { done, value } = await reader.value.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSE(buffer);

        // 保留未解析的内容
        const lastNewline = buffer.lastIndexOf("\n\n");
        if (lastNewline !== -1) {
          buffer = buffer.substring(lastNewline + 2);
        }

        for (const event of events) {
          switch (event.event) {
            case "message_start":
              options.onMessageStart?.(
                event.data as Parameters<
                  NonNullable<SSEOptions["onMessageStart"]>
                >[0],
              );
              break;
            case "content_delta":
              options.onContentDelta?.(
                event.data as Parameters<
                  NonNullable<SSEOptions["onContentDelta"]>
                >[0],
              );
              break;
            case "message_done":
              options.onMessageDone?.(
                event.data as Parameters<
                  NonNullable<SSEOptions["onMessageDone"]>
                >[0],
              );
              break;
            case "done":
              doneEventReceived = true;
              options.onDone?.(
                event.data as Parameters<NonNullable<SSEOptions["onDone"]>>[0],
              );
              break;
            case "error":
              doneEventReceived = true;
              options.onError?.(
                event.data as Parameters<NonNullable<SSEOptions["onError"]>>[0],
              );
              break;
          }
        }
      }

      // 安全网：流结束但未收到 done/error 事件时，仍触发 onDone
      if (!doneEventReceived) {
        options.onDone?.({ session_id: "" });
      }
    } finally {
      isConnected.value = false;
      reader.value = null;
    }
  }

  /**
   * 取消 SSE 连接
   */
  function cancel() {
    if (reader.value) {
      reader.value.cancel();
      reader.value = null;
    }
    isConnected.value = false;
  }

  // 组件卸载时自动取消
  onUnmounted(() => {
    cancel();
  });

  return {
    isConnected,
    processStream,
    cancel,
  };
}
