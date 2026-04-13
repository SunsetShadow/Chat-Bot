import { z } from 'zod';
import { MemoryService } from '../../memory/memory.service';
import { safeTool } from './base/tool.helper';

export function createKnowledgeQueryTool(memoryService: MemoryService) {
  return safeTool(
    'knowledge_query',
    '从用户的长期记忆和知识库中检索相关信息。当需要回忆用户偏好、历史事实、或先前对话内容时使用。',
    z.object({
      query: z.string().describe('查询内容'),
    }),
    async () => {
      const context = await memoryService.buildMemoryContext();
      if (!context) return '暂无相关记忆或知识。';
      return `相关记忆：\n${context}`;
    },
  );
}
