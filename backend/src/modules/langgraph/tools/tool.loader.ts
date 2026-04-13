import { DynamicStructuredTool } from '@langchain/core/tools';
import { AppConfigService } from '../../../config/config.service';
import { ToolRegistryService, ToolMetadata } from './tool-registry.service';
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

export function loadToolCollections(config: AppConfigService): ToolRegistration[] {
  return [
    {
      tool: createWebSearchTool({ bochaApiKey: config.bochaApiKey, bochaApiUrl: config.bochaApiUrl }),
      meta: { permission_level: 'read', category: 'search' },
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
      meta: { permission_level: 'write', category: 'communication' },
    },
    {
      tool: createTimeNowTool(),
      meta: { permission_level: 'read', category: 'system' },
    },
    {
      tool: createExecuteCommandTool(),
      meta: { permission_level: 'write', category: 'system' },
    },
    {
      tool: createReadFileTool(),
      meta: { permission_level: 'read', category: 'file' },
    },
    {
      tool: createWriteFileTool(),
      meta: { permission_level: 'write', category: 'file' },
    },
    {
      tool: createListDirectoryTool(),
      meta: { permission_level: 'read', category: 'file' },
    },
  ];
}

export function registerAllTools(
  registry: ToolRegistryService,
  config: AppConfigService,
): void {
  const tools = loadToolCollections(config);
  for (const { tool, meta } of tools) {
    registry.register(tool, meta);
  }
}
