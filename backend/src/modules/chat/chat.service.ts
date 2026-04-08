import { Injectable, NotFoundException } from '@nestjs/common';
import { generateId, getCurrentTimestamp } from '../../common/types';
import { AgentService } from '../agent/agent.service';
import { RuleService } from '../rule/rule.service';
import { MemoryService } from '../memory/memory.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  created_at: Date;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  is_pinned: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ChatService {
  private sessions = new Map<string, Session>();

  constructor(
    private agentService: AgentService,
    private ruleService: RuleService,
    private memoryService: MemoryService,
    private langGraphService: LangGraphService,
  ) {}

  async createCompletion(dto: CreateCompletionDto) {
    const { message, session_id, stream, agent_id, rule_ids } = dto;

    const session = session_id
      ? this.getSession(session_id)
      : this.createSession({ title: 'New Chat' });

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: message,
      created_at: getCurrentTimestamp(),
    };
    session.messages.push(userMessage);

    const systemPrompt = this.buildSystemPrompt(agent_id, rule_ids);
    const messages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (stream) {
      return { session, stream: true, messages, systemPrompt };
    }

    const response = await this.langGraphService.chat(messages, systemPrompt, session.id);
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: response.content,
      created_at: getCurrentTimestamp(),
    };
    session.messages.push(assistantMessage);
    session.updated_at = getCurrentTimestamp();

    return { session, assistantMessage, finish_reason: response.finish_reason };
  }

  async *streamCompletion(
    messages: { role: MessageRole; content: string }[],
    systemPrompt: string,
    sessionId: string,
    messageId: string,
  ): AsyncGenerator<{ event: string; data: any }> {
    yield {
      event: 'message_start',
      data: { session_id: sessionId, message_id: messageId, role: 'assistant' },
    };

    let fullContent = '';
    let hasError = false;

    try {
      for await (const chunk of this.langGraphService.chatStream(messages, systemPrompt, sessionId)) {
        if (chunk.content) {
          fullContent += chunk.content;
          yield {
            event: 'content_delta',
            data: { session_id: sessionId, message_id: messageId, content: chunk.content },
          };
        }
        if (chunk.finish_reason) {
          yield {
            event: 'message_done',
            data: { session_id: sessionId, message_id: messageId, finish_reason: chunk.finish_reason },
          };
        }
      }
    } catch (error) {
      hasError = true;
      yield {
        event: 'error',
        data: { session_id: sessionId, error: error.message, code: 'LLM_ERROR' },
      };
    }

    if (fullContent) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.messages.push({
          id: messageId,
          role: 'assistant',
          content: fullContent,
          created_at: getCurrentTimestamp(),
        });
        session.updated_at = getCurrentTimestamp();
      }
    }

    if (!hasError) {
      yield { event: 'done', data: {} };
    }
  }

  createSession(dto: CreateSessionDto): Session {
    const session: Session = {
      id: generateId(),
      title: dto.title || 'New Chat',
      messages: [],
      is_pinned: false,
      created_at: getCurrentTimestamp(),
      updated_at: getCurrentTimestamp(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  getSessions(page = 1, pageSize = 20) {
    const all = Array.from(this.sessions.values()).sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
      return b.updated_at.getTime() - a.updated_at.getTime();
    });

    const total = all.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = all.slice(start, start + pageSize);
    const sessions = data.map(({ messages, ...rest }) => ({ ...rest, message_count: messages.length }));

    return {
      data: sessions,
      pagination: { total, page, page_size: pageSize, total_pages: totalPages },
    };
  }

  getSession(id: string): Session {
    const session = this.sessions.get(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  togglePin(id: string, dto: UpdateSessionDto): Session {
    const session = this.getSession(id);
    session.is_pinned = dto.is_pinned;
    session.updated_at = getCurrentTimestamp();
    return session;
  }

  getMessages(sessionId: string): Message[] {
    return this.getSession(sessionId).messages;
  }

  private buildSystemPrompt(agentId?: string, ruleIds?: string[]): string {
    const parts: string[] = [];

    const resolvedAgentId = agentId || 'builtin-general';
    try {
      const agent = this.agentService.findOne(resolvedAgentId);
      if (agent.system_prompt) parts.push(agent.system_prompt);
    } catch { /* skip */ }

    const enabledRules = this.ruleService.getEnabledRules();
    const targetRules = ruleIds
      ? enabledRules.filter((r) => ruleIds.includes(r.id))
      : enabledRules;
    if (targetRules.length > 0) {
      parts.push(...targetRules.map((r) => r.content));
    }

    const memoryContext = this.memoryService.buildMemoryContext();
    if (memoryContext) parts.push(memoryContext);

    return parts.join('\n\n');
  }
}
