// 消息相关类型
export interface Attachment {
  id: string;
  filename: string;
  type: "image" | "document";
  url: string;
  size?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  // 扩展字段
  attachments?: Attachment[];
  thinking_process?: string;
  web_search_used?: boolean;
}

// 会话相关类型
export interface Session {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export interface SessionResponse {
  id: string;
  title: string;
  is_pinned: boolean;
  agent_id: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface SessionDetailResponse extends SessionResponse {
  messages: Message[];
}

// Agent 相关类型
export interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  traits: string[];
  tools: string[];
  skills: string[];
  model_name?: string;
  capabilities: string;
  enabled: boolean;
  temperature?: number;
  avatar?: string;
  category?: string;
  max_turns?: number;
  handoff_targets?: string[];
  is_builtin: boolean;
  is_system: boolean;
  standalone: boolean;
  rule_ids: string[];
  created_at: string;
  updated_at: string;
}

export type AgentCreate = Omit<Agent, 'id' | 'is_builtin' | 'is_system' | 'standalone' | 'created_at' | 'updated_at'>;
export type AgentUpdate = Partial<AgentCreate>;

// 工具信息
export type ToolPermission = "read" | "write" | "confirm";

export interface ToolInfo {
  name: string;
  description: string;
  permission_level: ToolPermission;
  category: string;
}

// 规则相关类型
export type RuleCategory = "behavior" | "format" | "constraint";
export type ConflictStrategy = "override" | "merge" | "reject";
export type RuleScope = "global" | "general";

export interface Rule {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  category: RuleCategory;
  priority: number;
  conflict_strategy: ConflictStrategy;
  is_builtin: boolean;
  scope: RuleScope;
  created_at: string;
  updated_at: string;
}

export interface RuleCreate {
  name: string;
  content: string;
  category?: RuleCategory;
  priority?: number;
  conflict_strategy?: ConflictStrategy;
  scope?: RuleScope;
}

export interface RuleUpdate {
  name?: string;
  content?: string;
  enabled?: boolean;
  category?: RuleCategory;
  priority?: number;
  conflict_strategy?: ConflictStrategy;
  scope?: RuleScope;
}

// 记忆相关类型
export type MemoryType = "fact" | "preference" | "event";

export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  source_session_id?: string;
  importance: number;
  created_at: string;
  last_accessed: string;
}

export interface MemoryCreate {
  content: string;
  type?: MemoryType;
  source_session_id?: string;
  importance?: number;
}

export interface MemoryUpdate {
  content?: string;
  type?: MemoryType;
  importance?: number;
}

// 聊天请求相关类型
export interface ChatCompletionRequest {
  message: string;
  session_id?: string;
  stream?: boolean;
  model?: string;
  agent_id?: string;
  rule_ids?: string[];
  // 新增参数
  attachment_ids?: string[];
  web_search?: boolean;
  thinking?: boolean;
}

export interface ChatCompletionResponse {
  session_id: string;
  message_id: string;
  role: "assistant";
  content: string;
  created_at: string;
}

// SSE 事件类型
export interface SSEMessageStart {
  session_id: string;
  message_id: string;
  role: "assistant";
}

export interface SSEContentDelta {
  session_id: string;
  message_id: string;
  content: string;
}

export interface SSEMessageDone {
  session_id: string;
  message_id: string;
  finish_reason: string;
}

export interface SSEDone {
  session_id: string;
}

export interface SSEError {
  session_id?: string;
  error: string;
  code: string;
}

// API 响应类型
export interface BaseResponse {
  success: boolean;
  message: string;
  code: string;
}

export interface DataResponse<T = unknown> extends BaseResponse {
  data: T;
}

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PaginatedResponse<T = unknown> extends BaseResponse {
  data: T[];
  pagination: PaginationMeta;
}

// Agent 模板预设
export interface AgentTemplate {
  name: string;
  description: string;
  system_prompt: string;
  traits: string[];
  tools: string[];
  capabilities: string;
  temperature: number;
  icon: string;
}

// Skill 技能包
export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  allowedTools?: string[];
  requires?: {
    bins?: string[];
    env?: string[];
  };
  instructions?: string;
}

// 系统设置相关类型
export interface Setting {
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface BrowseResult {
  currentPath: string;
  directories: string[];
  parentPath: string | null;
}
