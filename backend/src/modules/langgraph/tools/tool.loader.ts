import { DynamicStructuredTool } from '@langchain/core/tools';
import { AppConfigService } from '../../../config/config.service';
import { ToolRegistryService, ToolMetadata } from './tool-registry.service';

// Collection imports — 加新工具只需在这里加一行 import + 下面 register 调用
import { createWebSearchTool } from './collections/search.tools';
import { createSendMailTool } from './collections/communication.tools';
import { createTimeNowTool, createExecuteCommandTool } from './collections/system.tools';
import {
  createReadFileTool,
  createWriteFileTool,
  createListDirectoryTool,
} from './collections/file-system.tools';

interface ToolRegistration {
  tool: DynamicStructuredTool;
  meta: Partial<Omit<ToolMetadata, 'name'>>;
}

/**
 * 集中加载所有通用工具 collection
 *
 * 扩展方式：在对应 collection 文件中新增 create 函数，然后在此处 import 并注册
 */
export function loadToolCollections(config: AppConfigService): ToolRegistration[] {
  return [
    // 搜索
    {
      tool: createWebSearchTool({ bochaApiKey: config.bochaApiKey }),
      meta: { permission_level: 'read', category: 'search', description: '搜索互联网获取最新信息' },
    },
    // 通信
    {
      tool: createSendMailTool({
        mailHost: config.mailHost,
        mailPort: config.mailPort,
        mailSecure: config.mailSecure,
        mailUser: config.mailUser,
        mailPass: config.mailPass,
        mailFrom: config.mailFrom,
      }),
      meta: { permission_level: 'write', category: 'communication', description: '发送电子邮件' },
    },
    // 系统
    {
      tool: createTimeNowTool(),
      meta: { permission_level: 'read', category: 'system', description: '获取服务器当前时间' },
    },
    {
      tool: createExecuteCommandTool(),
      meta: { permission_level: 'write', category: 'system', description: '执行系统命令' },
    },
    // 文件系统
    {
      tool: createReadFileTool(),
      meta: { permission_level: 'read', category: 'file', description: '读取文件内容' },
    },
    {
      tool: createWriteFileTool(),
      meta: { permission_level: 'write', category: 'file', description: '写入文件内容' },
    },
    {
      tool: createListDirectoryTool(),
      meta: { permission_level: 'read', category: 'file', description: '列出目录内容' },
    },
  ];
}

/**
 * 将所有工具注册到 ToolRegistryService
 */
export function registerAllTools(
  registry: ToolRegistryService,
  config: AppConfigService,
): void {
  const tools = loadToolCollections(config);
  for (const { tool, meta } of tools) {
    registry.register(tool, meta);
  }
}
