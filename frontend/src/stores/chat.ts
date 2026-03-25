import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Message, SessionResponse, SessionDetailResponse } from "@/types";
import {
  createSession as apiCreateSession,
  getSessions as apiGetSessions,
  getSession as apiGetSession,
  deleteSession as apiDeleteSession,
  pinSession as apiPinSession,
} from "@/api/chat";

export const useChatStore = defineStore("chat", () => {
  // 状态
  const sessions = ref<SessionResponse[]>([]);
  const currentSession = ref<SessionDetailResponse | null>(null);
  const messages = ref<Message[]>([]);
  const isLoading = ref(false);
  const isSessionLoading = ref(false); // 新增：会话切换加载状态
  const isStreaming = ref(false);
  const currentStreamingContent = ref("");
  const currentStreamingMessageId = ref<string | null>(null);
  const error = ref<string | null>(null);

  // 计算属性
  const currentSessionId = computed(() => currentSession.value?.id);
  const hasCurrentSession = computed(() => !!currentSession.value);
  const messageCount = computed(() => messages.value.length);

  // 方法
  async function fetchSessions(page = 1, pageSize = 20) {
    isLoading.value = true;
    error.value = null;
    try {
      const result = await apiGetSessions(page, pageSize);
      sessions.value = result.sessions;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取会话列表失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function createSession(title?: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const session = await apiCreateSession(title);
      sessions.value.unshift(session);
      return session;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "创建会话失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function selectSession(sessionId: string) {
    isSessionLoading.value = true;
    error.value = null;
    try {
      const session = await apiGetSession(sessionId);
      currentSession.value = session;
      messages.value = session.messages;
      return session;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取会话详情失败";
      throw e;
    } finally {
      isSessionLoading.value = false;
    }
  }

  async function removeSession(sessionId: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await apiDeleteSession(sessionId);
      sessions.value = sessions.value.filter((s) => s.id !== sessionId);
      if (currentSession.value?.id === sessionId) {
        currentSession.value = null;
        messages.value = [];
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "删除会话失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function addMessage(message: Message) {
    messages.value.push(message);
    if (currentSession.value) {
      currentSession.value.message_count = messages.value.length;
    }
  }

  function updateMessage(messageId: string, content: string) {
    const index = messages.value.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      messages.value[index].content = content;
    }
  }

  function startStreaming(messageId: string) {
    isStreaming.value = true;
    currentStreamingContent.value = "";
    currentStreamingMessageId.value = messageId;
  }

  function appendStreamingContent(content: string) {
    currentStreamingContent.value += content;
  }

  function stopStreaming() {
    if (currentStreamingMessageId.value && currentStreamingContent.value) {
      updateMessage(
        currentStreamingMessageId.value,
        currentStreamingContent.value,
      );
    }
    isStreaming.value = false;
    currentStreamingContent.value = "";
    currentStreamingMessageId.value = null;
  }

  function clearCurrentSession() {
    currentSession.value = null;
    messages.value = [];
  }

  function clearError() {
    error.value = null;
  }

  /**
   * 直接设置当前会话 ID（不触发 API 调用）
   * 用于 SSE 响应中接收后端返回的 session_id
   */
  function setCurrentSessionId(sessionId: string) {
    if (!currentSession.value) {
      currentSession.value = {
        id: sessionId,
        title: "New Chat",
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0,
        messages: [],
      };
    }
  }

  /**
   * 切换会话置顶状态
   */
  async function pinSession(sessionId: string, isPinned: boolean) {
    try {
      const updatedSession = await apiPinSession(sessionId, isPinned);
      const index = sessions.value.findIndex((s) => s.id === sessionId);
      if (index !== -1) {
        sessions.value[index] = updatedSession;
      }
      if (currentSession.value?.id === sessionId) {
        currentSession.value = {
          ...currentSession.value,
          is_pinned: isPinned,
        };
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "切换置顶状态失败";
      throw e;
    }
  }

  return {
    // 状态
    sessions,
    currentSession,
    messages,
    isLoading,
    isSessionLoading,
    isStreaming,
    currentStreamingContent,
    currentStreamingMessageId,
    error,
    // 计算属性
    currentSessionId,
    hasCurrentSession,
    messageCount,
    // 方法
    fetchSessions,
    createSession,
    selectSession,
    removeSession,
    pinSession,
    addMessage,
    updateMessage,
    startStreaming,
    appendStreamingContent,
    stopStreaming,
    clearCurrentSession,
    clearError,
    setCurrentSessionId,
  };
});
