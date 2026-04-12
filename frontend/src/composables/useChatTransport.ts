import type {
  ChatTransport,
  UIMessage,
  UIMessageChunk,
  TextUIPart,
  ChatRequestOptions,
} from "ai";
import { API_BASE_URL } from "@/api/request";

/**
 * 自定义 ChatTransport，适配当前后端 SSE 协议
 *
 * 后端 SSE 事件格式:
 * - message_start: { session_id, message_id, role }
 * - content_delta: { session_id, message_id, content }
 * - message_done: { session_id, message_id, finish_reason }
 * - done: { session_id }
 * - error: { session_id?, error, code }
 *
 * AI SDK UIMessageChunk 格式:
 * - start: { type: 'start', messageId }
 * - text-start: { type: 'text-start', id }
 * - text-delta: { type: 'text-delta', id, delta }
 * - text-end: { type: 'text-end', id }
 * - finish: { type: 'finish', finishReason }
 * - error: { type: 'error', errorText }
 */
export function createChatTransport(
  getExtraBody?: () => Record<string, unknown>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
): ChatTransport<UIMessage> {
  return {
    async sendMessages({
      messages,
      abortSignal,
      body,
    }: {
      trigger: "submit-message" | "regenerate-message";
      chatId: string;
      messageId: string | undefined;
      messages: UIMessage[];
      abortSignal: AbortSignal | undefined;
    } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk>> {
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      const messageText =
        lastUserMessage?.parts
          ?.filter((p): p is TextUIPart => p.type === "text")
          .map((p) => p.text)
          .join("") || "";

      const extraBody = getExtraBody?.() || {};
      // session_id 只从 extraBody 获取，chatId 是 AI SDK 内部 ID 不传给后端
      const response = await fetch(`${API_BASE_URL}/api/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          stream: true,
          ...extraBody,
          ...(body as Record<string, unknown>),
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail?.message ||
            errorData.message ||
            `HTTP ${response.status}`,
        );
      }

      if (!response.body) {
        throw new Error("无法获取响应流");
      }

      return convertSSEStream(response.body, onSessionCreated, onAgentSwitched);
    },

    async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
      return null;
    },
  };
}

/**
 * 将后端 SSE 流转换为 AI SDK UIMessageChunk 流
 */
function convertSSEStream(
  rawStream: ReadableStream<Uint8Array>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
): ReadableStream<UIMessageChunk> {
  const reader = rawStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let textPartId = "";
  let messageId = "";

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSEEvents(buffer);
        const lastBoundary = buffer.lastIndexOf("\n\n");
        if (lastBoundary !== -1) {
          buffer = buffer.substring(lastBoundary + 2);
        }

        for (const event of events) {
          // 从 message_start 事件中提取 session_id 并回调
          if (event.event === "message_start" && onSessionCreated) {
            const sessionId = event.data.session_id as string | undefined;
            if (sessionId) {
              onSessionCreated(sessionId);
            }
          }

          // 处理 agent_switched 事件
          if (event.event === "agent_switched" && onAgentSwitched) {
            const from = (event.data.from as string) || "";
            const to = (event.data.to as string) || "";
            if (to) onAgentSwitched(from, to);
          }

          const chunks = convertEventToChunks(event, textPartId, messageId);
          for (const chunk of chunks) {
            if (chunk.type === "start" && chunk.messageId) {
              messageId = chunk.messageId;
            }
            if (chunk.type === "text-start") {
              textPartId = chunk.id;
            }
            controller.enqueue(chunk);
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

function parseSSEEvents(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = text.split("\n\n");

  for (const block of blocks) {
    const lines = block.split("\n");
    let event = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.substring(6).trim();
      } else if (line.startsWith("data:")) {
        data = line.substring(5).trim();
      }
    }

    if (event && data) {
      try {
        events.push({ event, data: JSON.parse(data) });
      } catch {
        // 忽略解析错误
      }
    }
  }

  return events;
}

function convertEventToChunks(
  sseEvent: SSEEvent,
  textPartId: string,
  currentMessageId: string,
): UIMessageChunk[] {
  const { event, data } = sseEvent;
  const id = crypto.randomUUID();

  switch (event) {
    case "message_start": {
      const msgId = (data.message_id as string) || currentMessageId;
      return [
        { type: "start", messageId: msgId },
        { type: "text-start", id: textPartId || id },
      ];
    }

    case "content_delta": {
      return [
        {
          type: "text-delta",
          id: textPartId || id,
          delta: (data.content as string) || "",
        },
      ];
    }

    case "message_done": {
      return [
        { type: "text-end", id: textPartId || id },
        {
          type: "finish",
          finishReason:
            (data.finish_reason as
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other") || "stop",
        },
      ];
    }

    case "tool_call_start": {
      return [
        {
          type: "tool-input-start",
          toolCallId: (data.tool_call_id as string) || id,
          toolName: (data.tool_name as string) || "unknown",
        },
      ];
    }

    case "tool_call_delta": {
      return [
        {
          type: "tool-input-delta",
          toolCallId: (data.tool_call_id as string) || id,
          inputTextDelta: (data.args_delta as string) || "",
        },
      ];
    }

    case "tool_call_input": {
      return [
        {
          type: "tool-input-available",
          toolCallId: (data.tool_call_id as string) || id,
          toolName: (data.tool_name as string) || "unknown",
          input: data.input as Record<string, unknown>,
        },
      ];
    }

    case "tool_call_output": {
      return [
        {
          type: "tool-output-available",
          toolCallId: (data.tool_call_id as string) || id,
          output: data.output,
        },
      ];
    }

    case "step_start": {
      // Chat 类会根据 tool chunks 自动生成 step-start parts
      return [];
    }

    case "done": {
      return [];
    }

    case "error": {
      return [
        { type: "error", errorText: (data.error as string) || "未知错误" },
      ];
    }

    default:
      return [];
  }
}
