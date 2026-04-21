import { ref, computed } from "vue";
import { Chat } from "@ai-sdk/vue";
import type { UIMessage } from "ai";
import { createChatTransport } from "./useChatTransport";
import { useAgentStore } from "@/stores/agent";
import { useRulesStore } from "@/stores/rules";
import { useModelStore } from "@/stores/model";
import { useChatStore } from "@/stores/chat";
import { getSession as apiGetSession } from "@/api/chat";

// 模块级单例：所有组件共享同一个 Chat 实例
let chatInstance: Chat<UIMessage> | null = null;

// 当前活跃 Agent（多 Agent 模式下由 supervisor 动态切换）
const activeAgent = ref<string | null>(null);

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
        (_from, to) => {
          activeAgent.value = to;
        },
      ),
      onError: (err) => {
        console.error("[AIChat] error:", err.message);
      },
      onFinish: ({ isError }) => {
        if (isError) {
          // 将错误信息注入最后一条空的 assistant 消息
          const msgs = chatInstance!.messages;
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            const hasText = last.parts?.some(
              (p) => p.type === "text" && p.text.trim(),
            );
            if (!hasText) {
              last.parts = [
                { type: "text", text: "请求失败，请稍后重试" },
              ];
            }
          }
          return;
        }
        const isNewSession = !chatStore.sessions.some(
          (s) => s.id === chatStore.currentSessionId,
        );
        if (isNewSession) {
          chatStore.fetchSessions();
        }

        // 延迟刷新标题（后端异步生成标题需要时间）
        const titleSessionId = chatStore.currentSessionId;
        if (titleSessionId) {
          setTimeout(async () => {
            try {
              const session = await apiGetSession(titleSessionId);
              if (session.title && session.title !== "New Chat") {
                chatStore.updateSessionTitle(titleSessionId, session.title);
              }
            } catch { /* 静默失败 */ }
          }, 3000);
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
      ttsSessionId?: string | null;
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
            ...(options?.ttsSessionId ? { tts_session_id: options.ttsSessionId } : {}),
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
    activeAgent.value = null;
  }

  function resetChat() {
    chat.messages = [];
    chatInstance = null;
    activeAgent.value = null;
  }

  return {
    messages,
    status,
    isLoading,
    error,
    activeAgent,
    sendMessage,
    stopStreaming,
    regenerate,
    loadMessages,
    clearMessages,
    resetChat,
  };
}
