import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryService } from '../../memory/memory.service';

/**
 * 知识库查询工具 — 从用户长期记忆中检索相关信息
 */
export function createKnowledgeQueryTool(memoryService: MemoryService) {
  return tool(
    async ({ query: _query }) => {
      try {
        const context = await memoryService.buildMemoryContext();
        if (!context) {
          return '暂无相关记忆或知识。';
        }
        return `相关记忆：\n${context}`;
      } catch (error) {
        return `查询失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
    {
      name: 'knowledge_query',
      description:
        '从用户的长期记忆和知识库中检索相关信息。当需要回忆用户偏好、历史事实、或先前对话内容时使用。',
      schema: z.object({
        query: z.string().describe('查询内容'),
      }),
    },
  );
}
