import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { generateId, getCurrentTimestamp } from '../../common/types';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

export interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  traits: string[];
  is_builtin: boolean;
  created_at?: Date;
  updated_at?: Date;
}

const BUILTIN_AGENTS: Agent[] = [
  {
    id: 'builtin-general',
    name: '通用助手',
    description: '默认的 AI 助手，可以回答各类问题',
    system_prompt: '你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。',
    traits: ['友好', '专业', '简洁'],
    is_builtin: true,
  },
  {
    id: 'builtin-programmer',
    name: '编程专家',
    description: '专业的编程问题解答，精通多种编程语言和框架',
    system_prompt: '你是一个资深的编程专家。请提供规范的代码、最佳实践和清晰的解释。代码需要包含必要的注释。',
    traits: ['专业', '代码规范', '最佳实践'],
    is_builtin: true,
  },
  {
    id: 'builtin-writer',
    name: '写作助手',
    description: '文案、创意写作支持，擅长各种文体',
    system_prompt: '你是一个专业的写作助手。请用优美的语言、清晰的结构来帮助用户完成各类写作任务。',
    traits: ['文采', '创意', '结构清晰'],
    is_builtin: true,
  },
];

@Injectable()
export class AgentService implements OnModuleInit {
  private agents = new Map<string, Agent>();

  onModuleInit() {
    for (const agent of BUILTIN_AGENTS) {
      this.agents.set(agent.id, { ...agent });
    }
  }

  findAll(): Agent[] {
    return Array.from(this.agents.values());
  }

  findOne(id: string): Agent {
    const agent = this.agents.get(id);
    if (!agent) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return agent;
  }

  create(dto: CreateAgentDto): Agent {
    const agent: Agent = {
      id: generateId(),
      name: dto.name,
      description: dto.description || '',
      system_prompt: dto.system_prompt || '',
      traits: dto.traits || [],
      is_builtin: false,
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  update(id: string, dto: UpdateAgentDto): Agent {
    const agent = this.findOne(id);
    if (agent.is_builtin) {
      throw new BadRequestException('Cannot modify built-in agents');
    }
    Object.assign(agent, {
      ...dto,
      updated_at: getCurrentTimestamp(),
    });
    this.agents.set(id, agent);
    return agent;
  }

  remove(id: string): void {
    const agent = this.findOne(id);
    if (agent.is_builtin) {
      throw new BadRequestException('Cannot delete built-in agents');
    }
    this.agents.delete(id);
  }
}
