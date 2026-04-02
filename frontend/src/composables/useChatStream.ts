import { ref, computed } from "vue";
import { useSSE } from "./useSSE";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agent";
import { useRulesStore } from "@/stores/rules";
import { createChatStream } from "@/api/chat";
import type { ChatCompletionRequest, Message } from "@/types";
import { generateId } from "@/utils/id";

/** 发送消息选项 */
export interface SendMessageOptions {
  attachments?: Array<{
    id: string;
    filename: string;
    type: "image" | "document";
    url: string;
    size?: number;
  }>;
  webSearch?: boolean;
  thinking?: boolean;
  model?: string;
}

/**
 * 流式聊天 composable
 */
export function useChatStream() {
  const chatStore = useChatStore();
  const agentStore = useAgentStore();
  const rulesStore = useRulesStore();
  const { isConnected, processStream, cancel } = useSSE();

  const isStreaming = computed(() => chatStore.isStreaming);
  const currentContent = computed(() => chatStore.currentStreamingContent);
  const error = ref<string | null>(null);

  /**
   * 发送流式消息
   */
  async function sendStreamMessage(
    message: string,
    options: SendMessageOptions = {},
  ): Promise<void> {
    if (isStreaming.value) {
      console.warn("已有正在进行的流式请求");
      return;
    }

    error.value = null;

    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
      // 扩展字段
      attachments: options.attachments,
    };
    chatStore.addMessage(userMessage);

    // 准备请求参数
    const request: ChatCompletionRequest = {
      message,
      session_id: chatStore.currentSessionId || undefined,
      stream: true,
      agent_id: agentStore.currentAgentId || undefined,
      rule_ids: Array.from(rulesStore.enabledRuleIds),
      // 新增参数
      attachment_ids: options.attachments?.map((a) => a.id),
      web_search: options.webSearch,
      thinking: options.thinking,
      model: options.model,
    };

    // 准备流式消息占位
    let assistantMessageId = generateId();

    try {
      // 创建流式连接
      const response = await createChatStream(request);

      // 开始流式处理
      chatStore.startStreaming(assistantMessageId);

      await processStream(response, {
        onMessageStart: (data) => {
          assistantMessageId = data.message_id;
          // 同步更新 store 中的 streaming message ID，确保 stopStreaming 时能正确更新消息
          chatStore.updateStreamingMessageId(data.message_id);

          // 使用后端返回的 session_id（如果是新会话）
          if (!chatStore.currentSessionId && data.session_id) {
            chatStore.setCurrentSessionId(data.session_id);
            // 立即添加到会话列表，让用户在左侧看到新会话
            chatStore.addSessionToList(data.session_id, message);
          }
        },
        onContentDelta: (data) => {
          chatStore.appendStreamingContent(data.content);
        },
        onMessageDone: () => {
          // 消息完成，添加到消息列表
          const assistantMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: chatStore.currentStreamingContent,
            created_at: new Date().toISOString(),
          };
          chatStore.addMessage(assistantMessage);
        },
        onDone: () => {
          chatStore.stopStreaming();
          // 只在新建会话时刷新列表（currentSessionId 之前不存在于 sessions 中）
          const isNewSession = !chatStore.sessions.some(
            (s) => s.id === chatStore.currentSessionId,
          );
          if (isNewSession) {
            chatStore.fetchSessions();
          }
        },
        onError: (data) => {
          error.value = data.error;
          chatStore.stopStreaming();
        },
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : "发送消息失败";
      chatStore.stopStreaming();
      throw e;
    }
  }

  /**
   * 取消当前流式请求
   */
  function cancelStream() {
    cancel();
    chatStore.stopStreaming();
  }

  return {
    isStreaming,
    isConnected,
    currentContent,
    error,
    sendStreamMessage,
    cancelStream,
  };
}
