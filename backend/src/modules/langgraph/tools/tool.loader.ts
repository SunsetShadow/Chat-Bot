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
      tool: createExecuteCommandTool(sandbox),
      meta: { permission_level: 'write', category: 'system' },
    },
    {
      tool: createReadFileTool(sandbox),
      meta: { permission_level: 'read', category: 'file' },
    },
    {
      tool: createWriteFileTool(sandbox),
      meta: { permission_level: 'write', category: 'file' },
    },
    {
      tool: createListDirectoryTool(sandbox),
      meta: { permission_level: 'read', category: 'file' },
    },
    {
      tool: createSearchFilesTool(sandbox),
      meta: { permission_level: 'read', category: 'file' },
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
