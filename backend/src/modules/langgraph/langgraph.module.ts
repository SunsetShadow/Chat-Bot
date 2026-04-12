import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangGraphService } from './langgraph.service';
import { MemoryModule } from '../memory/memory.module';
import { AgentModule } from '../agent/agent.module';
import { AgentService } from '../agent/agent.service';
import { AppConfigService } from '../../config/config.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ToolController } from './tools/tool.controller';
import { createMemoryExtractTool } from './tools/memory-extract.tool';
import { createKnowledgeQueryTool } from './tools/knowledge-query.tool';
import { createWebSearchTool } from './tools/web-search.tool';
import { createDelegateToAgentTool } from './tools/delegate-to-agent.tool';
import { MemoryService } from '../memory/memory.service';

@Module({
  imports: [ConfigModule, MemoryModule, AgentModule],
  controllers: [ToolController],
  providers: [LangGraphService, AppConfigService, ToolRegistryService],
  exports: [LangGraphService],
})
export class LangGraphModule implements OnModuleInit {
  constructor(
    private toolRegistry: ToolRegistryService,
    private memoryService: MemoryService,
    private langGraphService: LangGraphService,
    private agentService: AgentService,
  ) {}

  onModuleInit() {
    // 注册工具（含权限和分类）
    this.toolRegistry.register(createMemoryExtractTool(this.memoryService), {
      permission_level: 'write',
      category: 'memory',
      description: '从对话中提取重要信息保存为长期记忆',
    });
    this.toolRegistry.register(createKnowledgeQueryTool(this.memoryService), {
      permission_level: 'read',
      category: 'memory',
      description: '查询已保存的知识和记忆',
    });
    this.toolRegistry.register(createWebSearchTool(), {
      permission_level: 'read',
      category: 'search',
      description: '搜索互联网获取最新信息',
    });

    // 注册 Agent 间委托工具
    this.toolRegistry.register(
      createDelegateToAgentTool(async (id) => {
        try {
          const agent = await this.agentService.findOne(id);
          return { name: agent.name, capabilities: agent.capabilities || agent.description };
        } catch {
          return undefined;
        }
      }),
      {
        permission_level: 'read',
        category: 'orchestration',
        description: '将任务委托给另一个更专业的 Agent 处理',
      },
    );

    // 注册 agent 变更回调，触发 supervisor 图重建
    this.agentService.setRebuildCallback(() => {
      this.langGraphService.scheduleRebuild();
    });
  }
}
