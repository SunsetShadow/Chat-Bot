import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createDelegateToAgentTool(
  agentLookup: (id: string) => Promise<{ name: string; capabilities: string } | undefined>,
) {
  return new DynamicStructuredTool({
    name: 'delegate_to_agent',
    description:
      '查询其他可用 Agent 的信息。当你认为自己不是处理当前请求的最佳人选时，调用此工具查看是否有更合适的 Agent。',
    schema: z.object({
      agent_id: z.string().describe('目标 Agent 的 ID'),
    }),
    func: async ({ agent_id }) => {
      try {
        const target = await agentLookup(agent_id);
        if (!target) {
          return `未找到 Agent "${agent_id}"。当前没有匹配的专业助手。`;
        }
        return (
          `已识别专业助手：${target.name}\n` +
          `能力描述：${target.capabilities}\n` +
          `建议：请告知用户该任务更适合由「${target.name}」处理，` +
          `用户下次提问时系统会自动路由到对应的专业助手。`
        );
      } catch (e) {
        return `查询 Agent 信息失败：${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });
}
