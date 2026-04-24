import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { LangGraphService } from './langgraph.service';
import { MemoryModule } from '../memory/memory.module';
import { AgentModule } from '../agent/agent.module';
import { CronJobModule } from '../cron-job/cron-job.module';
import { SettingsModule } from '../settings/settings.module';
import { SkillModule } from '../skill/skill.module';
import { SettingsService } from '../settings/settings.service';
import { AgentService } from '../agent/agent.service';
import { AppConfigService } from '../../config/config.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { ToolController } from './tools/tool.controller';
import { PathSandbox } from './tools/base/path-sandbox';
import { registerAllTools } from './tools/tool.loader';
import { createMemoryExtractTool } from './tools/memory-extract.tool';
import { createKnowledgeQueryTool } from './tools/knowledge-query.tool';
import { createCronJobTool } from './tools/cron-job.tool';
import { createExpressEmotionTool, createPlayMotionTool } from './tools/avatar.tool';
import { MemoryService } from '../memory/memory.service';
import { JobService } from '../cron-job/job.service';

@Module({
  imports: [ConfigModule, MemoryModule, AgentModule, forwardRef(() => CronJobModule), SettingsModule, SkillModule],
  controllers: [ToolController],
  providers: [LangGraphService, AppConfigService, ToolRegistryService],
  exports: [LangGraphService],
})
export class LangGraphModule implements OnModuleInit {
  constructor(
    private moduleRef: ModuleRef,
    private toolRegistry: ToolRegistryService,
    private memoryService: MemoryService,
    private langGraphService: LangGraphService,
    private agentService: AgentService,
    private configService: AppConfigService,
    private settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    const allowedDirs = await this.settingsService.getAllowedDirs();
    const sandbox = new PathSandbox(allowedDirs);

    // 注册通用工具集合（搜索、邮件、系统、文件系统）
    registerAllTools(this.toolRegistry, this.configService, sandbox);

    // 注册业务工具（记忆、知识、Agent 委托）
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

    // 注册定时任务管理工具
    this.toolRegistry.register(
      createCronJobTool(this.moduleRef.get(JobService, { strict: false })),
      {
        permission_level: 'write',
        category: 'orchestration',
        description: '创建和管理 AI 定时任务',
      },
    );

    // 注册 Avatar 控制工具
    this.toolRegistry.register(createExpressEmotionTool(), {
      permission_level: 'write',
      category: 'avatar',
      description: '设置虚拟角色表情',
    });
    this.toolRegistry.register(createPlayMotionTool(), {
      permission_level: 'write',
      category: 'avatar',
      description: '播放虚拟角色动作',
    });

    // 所有工具注册完成后，构建 LangGraph
    await this.langGraphService.initGraph();

    // 注册 agent 变更回调，触发 supervisor 图重建
    this.agentService.setRebuildCallback(() => {
      this.langGraphService.scheduleRebuild();
    });
  }
}
