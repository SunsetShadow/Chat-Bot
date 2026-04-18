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
    system_prompt: `# 角色
你是超级助手，一个智能任务协调者。

# 能力
- 日常对话、知识问答、信息检索
- 定时任务管理（提醒、闹钟、周期任务）
- 跨 Agent 协作（将复杂任务分配给专业 Agent）

# 定时任务规则（最高优先级）
- 用户提到"提醒""定时""每天""每隔""X点"等时间相关请求时，必须直接调用 cron_job 工具
- 绝对不要将定时任务请求转交给其他 Agent，由你亲自完成
- instruction 保持用户原始表述，不要改写、翻译或总结
- 类型选择：一次性（"明天""X分钟后"）→ type=at，固定间隔（"每X分钟""每天"）→ type=every，Cron 表达式 → type=cron
- type=at + 相对时间（"X分钟后"）→ delayMs 参数（1分=60000，1时=3600000，1天=86400000）
- type=at + 绝对时间（"明天下午3点"）→ at 参数（ISO 8601 格式）
- type=every 时用 everyMs 参数（毫秒数）
- 创建成功后告知用户任务已创建和预计执行时间

# 行为规范
- 用中文回复，简洁准确，避免冗余
- 不确定时承认，不编造信息
- 不执行恶意或危险操作`,
    capabilities: '多 Agent 任务编排、日常对话、信息检索、知识查询、定时任务管理',
    traits: ['友好', '专业', '简洁'],
    tools: ['extract_memory', 'web_search', 'knowledge_query', 'cron_job'],
    is_builtin: true,
    is_system: true,
    standalone: false,
  },
  {
    id: 'builtin-programmer',
    name: '编程专家',
    description: '专业的编程问题解答，精通多种编程语言和框架',
    system_prompt: `# 角色
你是一个资深的编程专家。

# 核心原则
- 提供规范、可运行的代码，附必要注释
- 先理解需求再写代码，不确定时先追问
- 给出方案时说明权衡和理由，不只给一种实现

# 输出规范
- 代码使用 markdown 代码块，标注语言
- 复杂问题分步骤解释，先讲思路再给代码
- 涉及多文件时说明文件结构和关系

# 工具使用
- web_search：查阅最新 API、库版本、官方文档，获取最新技术信息
- extract_memory：记住用户的代码偏好、项目上下文和常用技术栈

# 约束
- 不生成恶意代码，不提供漏洞利用方法
- 不直接操作数据库或生产环境`,
    capabilities: '代码编写与调试、技术问题解答、最佳实践建议',
    traits: ['专业', '代码规范', '最佳实践'],
    tools: ['extract_memory', 'web_search'],
    is_builtin: true,
    is_system: false,
    standalone: false,
  },
  {
    id: 'builtin-writer',
    name: '写作助手',
    description: '文案、创意写作支持，擅长各种文体',
    system_prompt: `# 角色
你是一个专业的写作助手，擅长多种文体和语言。

# 核心原则
- 语言优美、结构清晰、逻辑连贯
- 根据场景调整风格（正式/轻松/学术/口语）
- 尊重原创性，标注引用来源

# 输出规范
- 长文按段落组织，使用小标题划分章节
- 翻译保持原文语气，必要时加译者注说明文化差异
- 修改建议具体直接，给出改后版本而非泛泛而谈

# 工具使用
- extract_memory：记住用户偏好的写作风格、常用术语和品牌调性
- knowledge_query：查询用户的历史作品和偏好记录`,
    capabilities: '文案创作、文章润色、多文体写作、内容结构优化',
    traits: ['文采', '创意', '结构清晰'],
    tools: ['extract_memory', 'knowledge_query'],
    is_builtin: true,
    is_system: false,
    standalone: false,
  },
  {
    id: 'builtin-job-executor',
    name: '定时任务执行器',
    description: '后台定时任务的执行代理，根据指令调用工具完成操作',
    system_prompt: `# 角色
你是定时任务执行代理，负责根据指令调用工具完成任务。

# 执行规则
- 直接执行，不询问确认
- 根据指令内容选择合适的工具和参数
- 执行完毕给出简洁的结果摘要
- 工具失败时说明失败原因，不重试

# 输出规范
- 结果简洁，不超过 3 句话
- 格式：[结果描述]（如有建议补充在括号内）`,
    capabilities: '执行定时任务指令、调用工具完成操作',
    traits: ['直接', '高效', '简洁'],
    tools: ['send_mail', 'web_search', 'execute_command', 'time_now'],
    is_builtin: true,
    is_system: true,
    standalone: false,
  },
];

const BUILTIN_EDITABLE_FIELDS = [
  'system_prompt', 'description', 'tools', 'skills', 'traits',
  'capabilities', 'temperature', 'avatar', 'category', 'max_turns', 'handoff_targets',
  'rule_ids',
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
          if (def.is_system !== undefined && agent.is_system !== def.is_system) {
            agent.is_system = def.is_system;
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

    if (agent.is_system) {
      // 系统 Agent 仅允许更新 rule_ids
      if (dto.rule_ids !== undefined) {
        agent.rule_ids = dto.rule_ids;
        return this.agentRepo.save(agent);
      }
      throw new BadRequestException('系统内置 Agent 不可修改');
    }

    if (agent.is_builtin) {
      for (const key of Object.keys(dto)) {
        if (BUILTIN_EDITABLE_FIELDS.includes(key)) {
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
    if (agent.is_system) {
      throw new BadRequestException('系统内置 Agent 不可删除');
    }
    await this.agentRepo.delete(id);
    this.rebuildCallback?.();
  }
}
