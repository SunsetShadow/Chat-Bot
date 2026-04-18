import { DynamicStructuredTool } from '@langchain/core/tools';
import { AppConfigService } from '../../../config/config.service';
import { ToolRegistryService, ToolMetadata } from './tool-registry.service';
import { PathSandbox } from './base/path-sandbox';
import { createWebSearchTool } from './collections/search.tools';
import { createSendMailTool } from './collections/communication.tools';
import { createTimeNowTool, createExecuteCommandTool } from './collections/system.tools';
import {
  createReadFileTool,
  createWriteFileTool,
  createListDirectoryTool,
} from './collections/file-system.tools';
import { createSearchFilesTool } from './collections/search-files.tool';

interface ToolRegistration {
  tool: DynamicStructuredTool;
  meta: Partial<Omit<ToolMetadata, 'name'>>;
}

export function loadToolCollections(config: AppConfigService, sandbox: PathSandbox): ToolRegistration[] {
  return [
    {
      tool: createWebSearchTool({ bochaApiKey: config.bochaApiKey, bochaApiUrl: config.bochaApiUrl }),
      meta: { permission_level: 'read', category: 'search', description: '搜索互联网获取最新信息' },
    },
    {
      tool: createSendMailTool({
        mailHost: config.mailHost,
        mailPort: config.mailPort,
        mailSecure: config.mailSecure,
        mailUser: config.mailUser,
        mailPass: config.mailPass,
        mailFrom: config.mailFrom,
      }),
      meta: { permission_level: 'write', category: 'communication', description: '发送邮件' },
    },
    {
      tool: createTimeNowTool(),
      meta: { permission_level: 'read', category: 'system', description: '获取当前日期和时间' },
    },
    {
      tool: createExecuteCommandTool(sandbox),
      meta: { permission_level: 'write', category: 'system', description: '执行终端命令' },
    },
    {
      tool: createReadFileTool(sandbox),
      meta: { permission_level: 'read', category: 'file', description: '读取文件内容' },
    },
    {
      tool: createWriteFileTool(sandbox),
      meta: { permission_level: 'write', category: 'file', description: '写入文件内容' },
    },
    {
      tool: createListDirectoryTool(sandbox),
      meta: { permission_level: 'read', category: 'file', description: '列出目录内容' },
    },
    {
      tool: createSearchFilesTool(sandbox),
      meta: { permission_level: 'read', category: 'file', description: '按文件名或内容搜索文件' },
    },
  ];
}

export function registerAllTools(
  registry: ToolRegistryService,
  config: AppConfigService,
  sandbox: PathSandbox,
): void {
  const tools = loadToolCollections(config, sandbox);
  for (const { tool, meta } of tools) {
    registry.register(tool, meta);
  }
}
