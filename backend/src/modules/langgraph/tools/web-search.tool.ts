import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * Web 搜索工具 — 调用外部搜索 API 获取实时信息
 * 当前为占位实现，后续接入实际搜索服务
 */
export function createWebSearchTool() {
  return tool(
    async ({ query }) => {
      try {
        // TODO: 接入实际搜索 API（如 SearXNG、Tavily、Bing 等）
        return `搜索功能暂未配置。请配置搜索 API 后使用。查询: ${query}`;
      } catch (error) {
        return `搜索失败: ${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
    {
      name: 'web_search',
      description:
        '搜索互联网获取最新信息。当需要查找实时数据、新闻、或不确定的事实性信息时使用。',
      schema: z.object({
        query: z.string().describe('搜索关键词'),
      }),
    },
  );
}
