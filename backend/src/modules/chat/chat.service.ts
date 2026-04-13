import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SessionEntity } from '../../common/entities/session.entity';
import { MessageEntity, MessageRole } from '../../common/entities/message.entity';
import { AgentService } from '../agent/agent.service';
import { RuleService } from '../rule/rule.service';
import { MemoryService } from '../memory/memory.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(SessionEntity)
    private sessionRepo: Repository<SessionEntity>,
    @InjectRepository(MessageEntity)
    private messageRepo: Repository<MessageEntity>,
    private agentService: AgentService,
    private ruleService: RuleService,
    private memoryService: MemoryService,
    private langGraphService: LangGraphService,
  ) {}

  async createCompletion(dto: CreateCompletionDto) {
    const { message, session_id, stream, agent_id, rule_ids } = dto;

    const session = session_id
      ? await this.getSession(session_id)
      : await this.createSession({ title: 'New Chat' });

    const userMessage = this.messageRepo.create({
      id: uuidv4(),
      role: 'user' as MessageRole,
      content: message,
      session: { id: session.id } as SessionEntity,
    });
    await this.messageRepo.save(userMessage);

    // Reload session with messages
    const sessionWithMessages = await this.sessionRepo.findOne({
      where: { id: session.id },
      relations: ['messages'],
    });

    const systemPrompt = await this.buildSystemPrompt(agent_id, rule_ids);
    const messages = sessionWithMessages!.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (stream) {
      return { session: sessionWithMessages, stream: true, messages, systemPrompt, agent_id };
    }

    const response = await this.langGraphService.chat(messages, systemPrompt, session.id, agent_id);
    const assistantMessage = this.messageRepo.create({
      id: uuidv4(),
      role: 'assistant' as MessageRole,
      content: response.content,
      session: { id: session.id } as SessionEntity,
    });
    await this.messageRepo.save(assistantMessage);

    session.updated_at = new Date();
    await this.sessionRepo.save(session);

    return { session: sessionWithMessages, assistantMessage, finish_reason: response.finish_reason };
  }

  async *streamCompletion(
    messages: { role: MessageRole; content: string }[],
    systemPrompt: string,
    sessionId: string,
    messageId: string,
    preferredAgent?: string,
  ): AsyncGenerator<{ event: string; data: any }> {
    yield {
      event: 'message_start',
      data: { session_id: sessionId, message_id: messageId, role: 'assistant' },
    };

    let fullContent = '';
    let hasError = false;

    try {
      for await (const event of this.langGraphService.chatStream(messages, systemPrompt, sessionId, preferredAgent)) {
        const base = { session_id: sessionId, message_id: messageId };

        switch (event.type) {
          case 'text':
            fullContent += event.content;
            yield { event: 'content_delta', data: { ...base, content: event.content } };
            break;

          case 'tool_start':
            yield { event: 'tool_call_start', data: { ...base, tool_call_id: event.toolCallId, tool_name: event.toolName } };
            break;

          case 'tool_delta':
            yield { event: 'tool_call_delta', data: { ...base, tool_call_id: event.toolCallId, args_delta: event.argsDelta } };
            break;

          case 'tool_input':
            yield { event: 'tool_call_input', data: { ...base, tool_call_id: event.toolCallId, tool_name: event.toolName, input: event.args } };
            break;

          case 'tool_output':
            yield { event: 'tool_call_output', data: { ...base, tool_call_id: event.toolCallId, output: event.output } };
            break;

          case 'step_start':
            yield { event: 'step_start', data: base };
            break;

          case 'agent_switched':
            yield {
              event: 'agent_switched',
              data: { ...base, from: event.fromAgent, to: event.toAgent },
            };
            break;

          case 'finish':
            yield { event: 'message_done', data: { ...base, finish_reason: event.finishReason } };
            break;
        }
      }
    } catch (error) {
      hasError = true;
      yield {
        event: 'error',
        data: { session_id: sessionId, error: error instanceof Error ? error.message : String(error), code: 'LLM_ERROR' },
      };
    }

    if (fullContent) {
      const msg = this.messageRepo.create({
        id: messageId,
        role: 'assistant' as MessageRole,
        content: fullContent,
        session: { id: sessionId } as SessionEntity,
      });
      await this.messageRepo.save(msg);

      await this.sessionRepo.update(sessionId, { updated_at: new Date() });
    }

    if (!hasError) {
      yield { event: 'done', data: {} };
    }
  }

  async createSession(dto: CreateSessionDto): Promise<SessionEntity> {
    const session = this.sessionRepo.create({
      id: uuidv4(),
      title: dto.title || 'New Chat',
      is_pinned: false,
    });
    return this.sessionRepo.save(session);
  }

  async getSessions(page = 1, pageSize = 20) {
    const [all, total] = await this.sessionRepo.findAndCount({
      relations: ['messages'],
      order: { is_pinned: 'DESC', updated_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);
    const sessions = all.map(({ messages, ...rest }) => ({ ...rest, message_count: messages.length }));

    return {
      data: sessions,
      pagination: { total, page, page_size: pageSize, total_pages: totalPages },
    };
  }

  async getSession(id: string): Promise<SessionEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['messages'],
    });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async togglePin(id: string, dto: UpdateSessionDto): Promise<SessionEntity> {
    const session = await this.getSession(id);
    session.is_pinned = dto.is_pinned;
    session.updated_at = new Date();
    return this.sessionRepo.save(session);
  }

  async getMessages(sessionId: string): Promise<MessageEntity[]> {
    const session = await this.getSession(sessionId);
    return session.messages;
  }

  private async buildSystemPrompt(agentId?: string, ruleIds?: string[]): Promise<string> {
    const parts: string[] = [];

    const resolvedAgentId = agentId || 'builtin-general';
    try {
      const agent = await this.agentService.findOne(resolvedAgentId);
      if (agent.system_prompt) parts.push(agent.system_prompt);
    } catch (e) {
      console.warn(`[ChatService] Failed to load agent ${resolvedAgentId}:`, e instanceof Error ? e.message : e);
    }

    const enabledRules = await this.ruleService.getEnabledRules();
    const targetRules = ruleIds
      ? enabledRules.filter((r) => ruleIds.includes(r.id))
      : enabledRules;
    if (targetRules.length > 0) {
      parts.push(...targetRules.map((r) => r.content));
    }

    const memoryContext = await this.memoryService.buildMemoryContext();
    if (memoryContext) parts.push(memoryContext);

    return parts.join('\n\n');
  }
}
