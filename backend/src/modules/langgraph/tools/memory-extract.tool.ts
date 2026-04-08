import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const memoryExtractTool = tool(
  async ({ content, memory_type, importance }) => {
    return JSON.stringify({
      action: 'extract_memory',
      content,
      memory_type,
      importance,
    });
  },
  {
    name: 'extract_memory',
    description:
      '从对话中提取重要信息并保存为长期记忆。当用户分享了个人偏好、重要事实、或关键事件时使用此工具。',
    schema: z.object({
      content: z.string().describe('提取的记忆内容，简洁明了'),
      memory_type: z
        .enum(['fact', 'preference', 'event'])
        .describe('记忆类型：fact=事实, preference=偏好, event=事件'),
      importance: z
        .number()
        .min(1)
        .max(10)
        .default(5)
        .describe('重要程度 1-10'),
    }),
  },
);
