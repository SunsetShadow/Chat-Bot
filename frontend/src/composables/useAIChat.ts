import { ref, computed } from "vue";
import { Chat } from "@ai-sdk/vue";
import type { UIMessage } from "ai";
import { createChatTransport } from "./useChatTransport";
import { useAgentStore } from "@/stores/agent";
import { useRulesStore } from "@/stores/rules";
import { useModelStore } from "@/stores/model";
import { useChatStore } from "@/stores/chat";

// 模块级单例：所有组件共享同一个 Chat 实例
let chatInstance: Chat<UIMessage> | null = null;

function getChatInstance(): Chat<UIMessage> {
  if (!chatInstance) {
    const chatStore = useChatStore();
    const agentStore = useAgentStore();
    const rulesStore = useRulesStore();
    const modelStore = useModelStore();

    chatInstance = new Chat({
      transport: createChatTransport(
        () => {
          const sessionId = chatStore.currentSessionId || undefined;
          const modelId = modelStore.getEffectiveModel(sessionId);
          return {
            session_id: sessionId,
            agent_id: agentStore.currentAgentId || undefined,
            rule_ids: Array.from(rulesStore.enabledRuleIds),
            model: modelId || undefined,
          };
        },
        (sessionId) => {
          if (!chatStore.currentSessionId && sessionId) {
            chatStore.setCurrentSessionId(sessionId);
            chatStore.addSessionToList(sessionId);
          }
        },
      ),
      onError: (err) => {
        console.error("[AIChat] error:", err.message);
      },
      onFinish: ({ isError }) => {
        if (isError) return;
        const isNewSession = !chatStore.sessions.some(
          (s) => s.id === chatStore.currentSessionId,
        );
        if (isNewSession) {
          chatStore.fetchSessions();
        }
      },
    });
  }
  return chatInstance;
}

/**
 * useAIChat - 基于 @ai-sdk/vue Chat 的聊天 composable
 *
 * 所有调用者共享同一个 Chat 实例（模块级单例），
 * 确保 MessageList 和 MessageInput 操作同一份消息状态。
 */
export function useAIChat() {
  const chat = getChatInstance();
  const error = ref<string | null>(null);

  const messages = computed(() => chat.messages);
  const status = computed(() => chat.status);
  const isLoading = computed(
    () => chat.status === "submitted" || chat.status === "streaming",
  );

  async function sendMessage(
    text: string,
    options?: {
      attachments?: Array<{
        id: string;
        filename: string;
        type: "image" | "document";
        url: string;
        size?: number;
      }>;
      webSearch?: boolean;
      thinking?: boolean;
    },
  ) {
    error.value = null;

    try {
      await chat.sendMessage(
        { text },
        {
          body: {
            web_search: options?.webSearch,
            thinking: options?.thinking,
          },
        },
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : "发送消息失败";
      throw e;
    }
  }

  async function stopStreaming() {
    await chat.stop();
  }

  async function regenerate() {
    error.value = null;
    try {
      await chat.regenerate();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "重新生成失败";
    }
  }

  function loadMessages(
    historyMessages: Array<{
      id: string;
      role: "user" | "assistant" | "system";
      content: string;
      created_at: string;
    }>,
  ) {
    const uiMessages: UIMessage[] = historyMessages.map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
    }));
    chat.messages = uiMessages;
  }

  function clearMessages() {
    chat.messages = [];
  }

  function resetChat() {
    chat.messages = [];
    chatInstance = null;
  }

  return {
    messages,
    status,
    isLoading,
    error,
    sendMessage,
    stopStreaming,
    regenerate,
    loadMessages,
    clearMessages,
    resetChat,
  };
}
