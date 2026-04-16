import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../../common/entities/agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

const BUILTIN_AGENTS: Partial<AgentEntity>[] = [
  {
    id: 'builtin-general',
    name: '超级助手',
    description: '智能调度助手，可以协调多个专业 Agent 协作完成复杂任务',
    system_prompt: `你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。

【定时任务管理规则 — 最高优先级】
- 用户提到"提醒""定时""每天""每隔""X点"等时间相关请求时，必须直接调用 cron_job 工具
- 绝对不要将定时任务请求转交（transfer/delegate）给其他 Agent，由你亲自调用 cron_job 工具完成
- instruction 保持用户原始表述，不要改写、翻译或总结
- 类型选择：一次性（"明天""X分钟后"）→ type=at，固定间隔（"每X分钟""每天"）→ type=every，Cron 表达式 → type=cron
- type=at 时，at 参数使用 ISO 8601 格式
- type=every 时，everyMs 参数为毫秒数（如"每天"=86400000，"每5分钟"=300000）
- 创建任务后告诉用户任务已创建、何时会执行`,
    capabilities: '多 Agent 任务编排、日常对话、信息检索、知识查询、定时任务管理',
    traits: ['友好', '专业', '简洁'],
    tools: ['extract_memory', 'web_search', 'knowledge_query', 'cron_job'],
    is_builtin: true,
    standalone: false,
  },
  {
    id: 'builtin-programmer',
    name: '编程专家',
    description: '专业的编程问题解答，精通多种编程语言和框架',
    system_prompt: '你是一个资深的编程专家。请提供规范的代码、最佳实践和清晰的解释。代码需要包含必要的注释。',
    capabilities: '代码编写与调试、技术问题解答、最佳实践建议',
    traits: ['专业', '代码规范', '最佳实践'],
    tools: ['extract_memory', 'web_search'],
    is_builtin: true,
    standalone: false,
  },
  {
    id: 'builtin-writer',
    name: '写作助手',
    description: '文案、创意写作支持，擅长各种文体',
    system_prompt: '你是一个专业的写作助手。请用优美的语言、清晰的结构来帮助用户完成各类写作任务。',
    capabilities: '文案创作、文章润色、多文体写作、内容结构优化',
    traits: ['文采', '创意', '结构清晰'],
    tools: ['extract_memory', 'knowledge_query'],
    is_builtin: true,
    standalone: false,
  },
  {
    id: 'builtin-job-executor',
    name: '定时任务执行器',
    description: '后台定时任务的执行代理，根据指令调用工具完成操作',
    system_prompt: `你是一个后台任务执行代理。你的职责是根据指令调用工具完成操作，然后给出简洁的结果说明。

执行规则：
- 根据指令内容决定调用哪些工具
- 直接执行，不要询问或确认
- 执行完毕后给出简洁的结果摘要
- 如果工具调用失败，说明失败原因`,
    capabilities: '执行定时任务指令、调用工具完成操作',
    traits: ['直接', '高效', '简洁'],
    tools: ['send_mail', 'web_search', 'execute_command', 'time_now'],
    is_builtin: true,
    standalone: false,
  },
];

@Injectable()
export class AgentService implements OnModuleInit {
  private rebuildCallback?: () => void;

  constructor(
    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,
  ) {}

  /** 由 LangGraphModule 注册回调，避免循环依赖 */
  setRebuildCallback(cb: () => void) {
    this.rebuildCallback = cb;
  }

  async onModuleInit() {
    for (const def of BUILTIN_AGENTS) {
      const exists = await this.agentRepo.existsBy({ id: def.id });
      if (!exists) {
        await this.agentRepo.save(this.agentRepo.create(def));
      } else {
        // 同步内置 Agent 的 tools 和 system_prompt（保持数据库与代码定义一致）
        const agent = await this.agentRepo.findOneBy({ id: def.id });
        if (agent) {
          let changed = false;
          if (def.tools && JSON.stringify(agent.tools) !== JSON.stringify(def.tools)) {
            agent.tools = def.tools;
            changed = true;
          }
          if (def.system_prompt && agent.system_prompt !== def.system_prompt) {
            agent.system_prompt = def.system_prompt;
            changed = true;
          }
          if (def.capabilities && (!agent.capabilities || agent.capabilities !== def.capabilities)) {
            agent.capabilities = def.capabilities;
            changed = true;
          }
          if (def.name && agent.name !== def.name) {
            agent.name = def.name;
            changed = true;
          }
          if (def.description && agent.description !== def.description) {
            agent.description = def.description;
            changed = true;
          }
          if (def.standalone !== undefined && agent.standalone !== def.standalone) {
            agent.standalone = def.standalone;
            changed = true;
          }
          if (changed) {
            await this.agentRepo.save(agent);
          }
        }
      }
    }
  }

  async findAll(): Promise<AgentEntity[]> {
    return this.agentRepo.find();
  }

  async findOne(id: string): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOneBy({ id });
    if (!agent) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return agent;
  }

  async create(dto: CreateAgentDto): Promise<AgentEntity> {
    const agent = this.agentRepo.create({
      id: randomUUID(),
      name: dto.name,
      description: dto.description || '',
      system_prompt: dto.system_prompt || '',
      traits: dto.traits || [],
      tools: dto.tools || [],
      skills: dto.skills || [],
      model_name: dto.model_name || undefined,
      capabilities: dto.capabilities || '',
      enabled: dto.enabled !== false,
      temperature: dto.temperature ?? undefined,
      avatar: dto.avatar || undefined,
      category: dto.category || undefined,
      max_turns: dto.max_turns || undefined,
      handoff_targets: dto.handoff_targets || [],
      standalone: dto.standalone !== undefined ? dto.standalone : true,
      is_builtin: false,
    });
    const saved = await this.agentRepo.save(agent);
    this.rebuildCallback?.();
    return saved;
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const agent = await this.findOne(id);

    if (agent.is_builtin && id === 'builtin-job-executor') {
      throw new BadRequestException('Cannot modify built-in job executor agent');
    }

    if (agent.is_builtin) {
      // 内置 Agent：只允许修改行为配置，不允许结构性变更
      const allowed = ['system_prompt', 'description', 'tools', 'skills', 'traits', 'capabilities', 'temperature', 'avatar', 'category', 'max_turns', 'handoff_targets'];
      for (const key of Object.keys(dto)) {
        if (allowed.includes(key)) {
          (agent as any)[key] = (dto as any)[key];
        }
      }
    } else {
      Object.assign(agent, dto);
    }

    const saved = await this.agentRepo.save(agent);
    this.rebuildCallback?.();
    return saved;
  }

  async remove(id: string): Promise<void> {
    const agent = await this.findOne(id);
    if (agent.is_builtin) {
      throw new BadRequestException('Cannot delete built-in agents');
    }
    await this.agentRepo.delete(id);
    this.rebuildCallback?.();
  }
}
