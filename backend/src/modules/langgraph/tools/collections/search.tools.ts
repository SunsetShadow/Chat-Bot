import { z } from 'zod';
import { safeTool } from '../base/tool.helper';

export interface SearchToolDeps {
  bochaApiKey: string;
}

/**
 * 创建联网搜索工具 — 调用 Bocha Web Search API
 */
export function createWebSearchTool(deps: SearchToolDeps) {
  return safeTool(
    'web_search',
    `搜索互联网获取最新信息。

何时使用：
- 用户询问实时信息（新闻、天气、汇率、股价等）
- 需要验证某个事实是否仍然正确
- 用户明确要求"搜索"、"查一下"、"搜一下"
- 对话涉及近期发生的事件

注意：
- 对于常识性问题（如数学、历史事实）不需要搜索
- 搜索结果可能不是最新的，对于极度时间敏感的信息请告知用户`,
    z.object({
      query: z.string().describe('搜索关键词，尽量精炼'),
      count: z.number().int().min(1).max(20).optional().describe('返回结果数量，默认 10'),
    }),
    async ({ query, count }) => {
      if (!deps.bochaApiKey) {
        return '搜索功能未配置：缺少 BOCHA_API_KEY 环境变量。请在 .env 中配置后使用。';
      }

      const response = await fetch('https://api.bochaai.com/v1/web-search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deps.bochaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          freshness: 'noLimit',
          summary: true,
          count: count ?? 10,
        }),
      });

      const json = await response.json();
      if (json.code !== 200 || !json.data) {
        return `搜索失败: ${json.msg ?? '未知错误'}`;
      }

      const webpages = json.data.webPages?.value ?? [];
      if (!webpages.length) return '未找到相关结果。';

      return webpages
        .map(
          (page: any, idx: number) =>
            `[${idx + 1}] ${page.name}\nURL: ${page.url}\n摘要: ${page.summary}\n来源: ${page.siteName}${page.dateLastCrawled ? `\n时间: ${page.dateLastCrawled}` : ''}`,
        )
        .join('\n\n');
    },
  );
}
