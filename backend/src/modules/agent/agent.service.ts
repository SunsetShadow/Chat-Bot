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
    name: '通用助手',
    description: '默认的 AI 助手，可以回答各类问题',
    system_prompt: '你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。',
    capabilities: '处理日常对话、回答常识性问题、信息检索、知识查询',
    traits: ['友好', '专业', '简洁'],
    tools: ['extract_memory', 'web_search', 'knowledge_query', 'delegate_to_agent'],
    is_builtin: true,
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
        // 更新已有内置 Agent 的 capabilities 和 tools（仅当为空时）
        const agent = await this.agentRepo.findOneBy({ id: def.id });
        if (agent && (!agent.capabilities || agent.capabilities === '')) {
          agent.capabilities = def.capabilities || '';
          if (def.tools) agent.tools = def.tools;
          await this.agentRepo.save(agent);
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
      is_builtin: false,
    });
    const saved = await this.agentRepo.save(agent);
    this.rebuildCallback?.();
    return saved;
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const agent = await this.findOne(id);

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
