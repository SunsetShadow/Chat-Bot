import type {
  Agent,
  AgentCreate,
  AgentUpdate,
  ChatCompletionRequest,
  ChatCompletionResponse,
  DataResponse,
  Memory,
  MemoryCreate,
  MemoryType,
  PaginatedResponse,
  Rule,
  RuleCreate,
  RuleUpdate,
  SessionDetailResponse,
  SessionResponse,
} from "@/types";
import { API_BASE_URL, del, get, post, put } from "./request";

// ============ 聊天相关 API ============

/**
 * 发送聊天消息（非流式）
 */
export async function sendMessage(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  const response = await post<DataResponse<ChatCompletionResponse>>(
    "/api/v1/chat/completions",
    { ...request, stream: false },
  );
  return response.data;
}

/**
 * 创建会话
 */
export async function createSession(title?: string): Promise<SessionResponse> {
  const response = await post<DataResponse<SessionResponse>>(
    "/api/v1/chat/sessions",
    { title },
  );
  return response.data;
}

/**
 * 获取会话列表
 */
export async function getSessions(
  page = 1,
  pageSize = 20,
): Promise<{ sessions: SessionResponse[]; total: number }> {
  const response = await get<PaginatedResponse<SessionResponse>>(
    "/api/v1/chat/sessions",
    {
      page,
      page_size: pageSize,
    },
  );
  return {
    sessions: response.data,
    total: response.pagination.total,
  };
}

/**
 * 获取会话详情
 */
export async function getSession(
  sessionId: string,
): Promise<SessionDetailResponse> {
  const response = await get<DataResponse<SessionDetailResponse>>(
    `/api/v1/chat/sessions/${sessionId}`,
  );
  return response.data;
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await del(`/api/v1/chat/sessions/${sessionId}`);
}

/**
 * 切换会话置顶状态
 */
export async function pinSession(
  sessionId: string,
  isPinned: boolean,
): Promise<SessionResponse> {
  const response = await put<DataResponse<SessionResponse>>(
    `/api/v1/chat/sessions/${sessionId}/pin`,
    { is_pinned: isPinned },
  );
  return response.data;
}

// ============ Agent 相关 API ============

/**
 * 获取 Agent 列表
 */
export async function getAgents(): Promise<Agent[]> {
  const response = await get<DataResponse<Agent[]>>("/api/v1/agents");
  return response.data;
}

/**
 * 创建 Agent
 */
export async function createAgent(data: AgentCreate): Promise<Agent> {
  const response = await post<DataResponse<Agent>>("/api/v1/agents", data);
  return response.data;
}

/**
 * 更新 Agent
 */
export async function updateAgent(
  id: string,
  data: AgentUpdate,
): Promise<Agent> {
  const response = await put<DataResponse<Agent>>(`/api/v1/agents/${id}`, data);
  return response.data;
}

/**
 * 删除 Agent
 */
export async function deleteAgent(id: string): Promise<void> {
  await del(`/api/v1/agents/${id}`);
}

// ============ 规则相关 API ============

/**
 * 获取规则列表
 */
export async function getRules(enabledOnly = false): Promise<Rule[]> {
  const response = await get<DataResponse<Rule[]>>("/api/v1/rules", {
    enabled_only: enabledOnly,
  });
  return response.data;
}

/**
 * 创建规则
 */
export async function createRule(data: RuleCreate): Promise<Rule> {
  const response = await post<DataResponse<Rule>>("/api/v1/rules", data);
  return response.data;
}

/**
 * 更新规则
 */
export async function updateRule(id: string, data: RuleUpdate): Promise<Rule> {
  const response = await put<DataResponse<Rule>>(`/api/v1/rules/${id}`, data);
  return response.data;
}

/**
 * 删除规则
 */
export async function deleteRule(id: string): Promise<void> {
  await del(`/api/v1/rules/${id}`);
}

// ============ 记忆相关 API ============

/**
 * 获取记忆列表
 */
export async function getMemories(
  type?: MemoryType,
  minImportance = 1,
): Promise<Memory[]> {
  const params: Record<string, string | number | boolean> = {
    min_importance: minImportance,
  };
  if (type) {
    params.type = type;
  }
  const response = await get<DataResponse<Memory[]>>(
    "/api/v1/memories",
    params,
  );
  return response.data;
}

/**
 * 创建记忆
 */
export async function createMemory(data: MemoryCreate): Promise<Memory> {
  const response = await post<DataResponse<Memory>>("/api/v1/memories", data);
  return response.data;
}

/**
 * 删除记忆
 */
export async function deleteMemory(id: string): Promise<void> {
  await del(`/api/v1/memories/${id}`);
}

// ============ SSE 流式聊天 ============

/**
 * 创建 SSE 流式连接
 */
export async function createChatStream(
  request: ChatCompletionRequest,
): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}/api/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail?.message ||
        errorData.message ||
        `HTTP ${response.status}`,
    );
  }

  return response;
}
