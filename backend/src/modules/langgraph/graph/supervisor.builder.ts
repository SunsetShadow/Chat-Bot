import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CompiledStateGraph } from '@langchain/langgraph';

export const ANI_ID = 'ani';

export interface AgentDefinition {
  id: string;
  name: string;
  system_prompt: string;
  capabilities: string;
  tools: string[];
  model_name?: string;
  temperature?: number;
  enabled: boolean;
  is_system?: boolean;
}

/**
 * 构建多 Agent Supervisor 图
 *
 * 架构：supervisor → [worker_A | worker_B | ...] → supervisor → ... → END
 * - supervisor 根据 capabilities 描述将任务分配给最合适的 worker agent
 * - 每个 worker agent 有独立的 system prompt、工具集、可选模型
 * - 支持 preferredAgent 偏好提示
 */
export function buildSupervisorGraph(
  model: ChatOpenAI,
  agentDefinitions: AgentDefinition[],
  toolLookup: (name: string) => DynamicStructuredTool | undefined,
  modelFactory?: (modelName: string) => ChatOpenAI,
  allTools?: DynamicStructuredTool[],
): CompiledStateGraph<any, any, any> {
  const checkpointer = new MemorySaver();

  // 过滤启用的 Agent
  const enabledAgents = agentDefinitions.filter((d) => d.enabled);
  if (enabledAgents.length === 0) {
    throw new Error('No enabled agents available for supervisor');
  }

  // 为每个 agent 定义创建一个 React Agent
  const workerAgents = enabledAgents.map((def) => {
    const isAni = def.id === ANI_ID;
    const agentTools = isAni
      ? (allTools || [])
      : def.tools
          .map((name) => toolLookup(name))
          .filter((t): t is DynamicStructuredTool => t !== undefined);

    // 支持独立模型 + temperature
    let agentModel: ChatOpenAI;
    if (def.model_name && modelFactory) {
      agentModel = modelFactory(def.model_name);
    } else {
      agentModel = model;
    }

    // 如果指定了 temperature，创建新实例覆盖
    if (def.temperature !== undefined && def.temperature !== null) {
      agentModel = new ChatOpenAI({
        modelName: (agentModel as any).modelName || (agentModel as any).lc_kwargs?.modelName,
        openAIApiKey: (agentModel as any).lc_kwargs?.openAIApiKey,
        configuration: (agentModel as any).lc_kwargs?.configuration,
        streaming: true,
        temperature: def.temperature,
      });
    }

    const agentIdHint = isAni
      ? `\n\n[Agent 身份] 你是 Ani（Agent ID: "${def.id}"），作为默认助手直接处理用户的请求。调用 extract_memory 或 knowledge_query 工具时，请传入 agent_id="${def.id}"。`
      : `\n\n[Agent 身份] 你的 Agent ID 是 "${def.id}"。调用 extract_memory 或 knowledge_query 工具时，请传入 agent_id="${def.id}" 以确保记忆隔离。`;

    return createReactAgent({
      llm: agentModel,
      tools: agentTools,
      prompt: def.system_prompt + agentIdHint,
      name: def.id,
    });
  });

  // Agent 能力描述，供 Supervisor 路由决策
  const agentDescriptions = enabledAgents
    .map((def) => {
      const tools = def.id === ANI_ID
        ? '全部工具（含 Avatar 表达控制）'
        : (def.tools.join(', ') || '无');
      return `- ${def.name}（${def.id}）: ${def.capabilities || ''} | 可用工具: ${tools}`;
    })
    .join('\n');

  const supervisor = createSupervisor({
    agents: workerAgents as any,
    llm: model,
    prompt: `你是一个智能任务协调器（Supervisor）。你的职责是分析用户请求，将其分配给最合适的专业 AI 助手。

## 关键约束
你只能通过 transfer_to_* 工具将任务转交给助手，你**没有**任何其他工具。永远不要尝试调用不属于你的工具。

## 可用助手
${agentDescriptions}

## 编排规则
1. 分析用户请求，判断需要哪个（些）助手
2. 简单问题（闲聊、查询、解释、定时任务等）直接 transfer 给 Ani
3. 需要专业处理的任务 transfer 给对应专家助手
4. 助手返回结果后，决定是否需要继续调用其他助手或直接回复用户
5. 用户指定偏好助手时，该助手能力范围内的任务优先转给它

## 特殊路由规则
- 定时任务、提醒、闹钟 → transfer 给 Ani（Ani 拥有 cron_job 工具）
- 记忆提取、知识查询 → transfer 给拥有相应工具的助手
- 联网搜索 → transfer 给 Ani（Ani 拥有 web_search 工具）
- 编程问题 → transfer 给编程专家
- 写作任务 → transfer 给写作助手`,
    outputMode: 'full_history',
    addHandoffBackMessages: true,
    supervisorName: 'supervisor',
  });

  return supervisor.compile({ checkpointer });
}
