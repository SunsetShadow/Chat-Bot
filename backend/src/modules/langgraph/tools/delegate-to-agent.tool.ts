import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createDelegateToAgentTool(
  agentLookup: (id: string) => { name: string; capabilities: string } | undefined,
) {
  return new DynamicStructuredTool({
    name: 'delegate_to_agent',
    description:
      '将当前任务委托给另一个更专业的 Agent 处理。仅在当前 Agent 无法很好处理用户请求时使用。使用前需确认目标 Agent 的 ID。',
    schema: z.object({
      agent_id: z.string().describe('目标 Agent 的 ID'),
      task: z.string().describe('需要委托的任务描述'),
      context: z.string().optional().describe('传递给目标 Agent 的上下文信息'),
    }),
    func: async ({ agent_id, task, context }) => {
      const target = agentLookup(agent_id);
      if (!target) {
        return `错误：找不到 Agent "${agent_id}"。请检查 Agent ID 是否正确。`;
      }
      return JSON.stringify({
        __delegation__: true,
        target_agent: agent_id,
        target_name: target.name,
        task,
        context: context || '',
      });
    },
  });
}
