import { Injectable } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';

export type ToolPermission = 'read' | 'write' | 'confirm';
export type ToolCategory = 'search' | 'communication' | 'system' | 'file' | 'memory' | 'orchestration' | 'general' | 'avatar';

export interface ToolMetadata {
  name: string;
  description: string;
  permission_level: ToolPermission;
  category: ToolCategory;
}

@Injectable()
export class ToolRegistryService {
  private tools = new Map<string, DynamicStructuredTool>();
  private metadata = new Map<string, ToolMetadata>();

  register(tool: DynamicStructuredTool, meta?: Partial<Omit<ToolMetadata, 'name'>>): void {
    this.tools.set(tool.name, tool);
    this.metadata.set(tool.name, {
      name: tool.name,
      description: meta?.description || tool.description || '',
      permission_level: meta?.permission_level || 'read',
      category: meta?.category || 'general',
    });
  }

  get(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name);
  }

  getForAgent(toolNames: string[]): DynamicStructuredTool[] {
    return toolNames
      .map(name => this.tools.get(name))
      .filter((t): t is DynamicStructuredTool => t !== undefined);
  }

  getAll(): DynamicStructuredTool[] {
    return Array.from(this.tools.values());
  }

  getAllNames(): string[] {
    return Array.from(this.tools.keys());
  }

  getMetadata(name: string): ToolMetadata | undefined {
    return this.metadata.get(name);
  }

  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }
}
