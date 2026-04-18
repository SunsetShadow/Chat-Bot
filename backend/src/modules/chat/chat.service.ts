import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { SessionEntity } from '../../common/entities/session.entity';
import { MessageEntity, MessageRole } from '../../common/entities/message.entity';
import { AgentService } from '../agent/agent.service';
import { RuleService } from '../rule/rule.service';
import { MemoryService } from '../memory/memory.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import { AppConfigService } from '../../config/config.service';
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
    private configService: AppConfigService,
  ) {}

  async createCompletion(dto: CreateCompletionDto) {
    const { message, session_id, stream, agent_id, rule_ids, web_search } = dto;

    const session = session_id
      ? await this.getSession(session_id)
      : await this.createSession({ title: 'New Chat' });

    // 保存当前使用的 agent_id 到 session
    if (agent_id && session.agent_id !== agent_id) {
      session.agent_id = agent_id;
      await this.sessionRepo.save(session);
    }

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

    const systemPrompt = await this.buildSystemPrompt(agent_id, rule_ids, web_search);
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

    // 异步生成对话标题
    this.generateTitleIfNeeded(session.id, messages, response.content).catch(() => {});

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

      // 异步生成对话标题（仅当标题为默认值时）
      this.generateTitleIfNeeded(sessionId, messages, fullContent).catch(() => {});
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

  async deleteSession(id: string): Promise<void> {
    const session = await this.getSession(id);
    await this.messageRepo.delete({ session: { id: session.id } } as any);
    await this.sessionRepo.delete(session.id);
  }

  private async buildSystemPrompt(agentId?: string, ruleIds?: string[], webSearch?: boolean): Promise<string> {
    const parts: string[] = [];

    const resolvedAgentId = agentId || 'builtin-general';
    try {
      const agent = await this.agentService.findOne(resolvedAgentId);
      if (agent.system_prompt) parts.push(agent.system_prompt);
    } catch (e) {
      console.warn(`[ChatService] Failed to load agent ${resolvedAgentId}:`, e instanceof Error ? e.message : e);
    }

    // 自动注入当前时间，让 Agent 始终感知当前日期
    const now = new Date();
    const timeContext = `当前时间：${now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    parts.push(timeContext);

    if (webSearch) {
      parts.push(
        '[联网搜索已开启] 请先判断用户意图：如果用户询问最新信息、新闻、实时数据、近期事件等需要最新数据的请求，调用 web_search tool 搜索相关信息后基于搜索结果回答；对于普通对话、知识问答、代码编写等不需要实时数据的请求，不要调用 web_search tool。',
      );
    } else {
      parts.push(
        '[联网搜索已关闭] 不要调用 web_search tool。直接用已有知识回答用户问题。',
      );
    }

    // 1. 全局规则：强制注入
    const globalRules = await this.ruleService.getGlobalRules();

    // 2. Agent 级 general 规则：优先用前端传的 rule_ids，否则用 Agent 实体的 rule_ids
    let agentRuleIds = ruleIds;
    if (!agentRuleIds || agentRuleIds.length === 0) {
      try {
        const agent = await this.agentService.findOne(resolvedAgentId);
        agentRuleIds = agent.rule_ids || [];
      } catch {
        agentRuleIds = [];
      }
    }
    const agentRules = await this.ruleService.getRulesByIds(agentRuleIds);

    // 合并去重（global 优先级高）
    const allRules = [...globalRules];
    const globalIds = new Set(globalRules.map((r) => r.id));
    for (const r of agentRules) {
      if (!globalIds.has(r.id)) allRules.push(r);
    }

    if (allRules.length > 0) {
      parts.push(...allRules.map((r) => r.content));
    }

    const memoryContext = await this.memoryService.buildMemoryContext();
    if (memoryContext) parts.push(memoryContext);

    return parts.join('\n\n');
  }

  /**
   * 异步生成对话标题（仅当标题为默认值 "New Chat" 时触发）
   * 使用轻量 LLM 调用，不阻塞主流程
   */
  private async generateTitleIfNeeded(
    sessionId: string,
    historyMessages: { role: string; content: string }[],
    assistantReply: string,
  ): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.title !== 'New Chat') return;

    // 取用户第一条消息和 AI 回复的前 200 字符
    const firstUserMsg = historyMessages.find((m) => m.role === 'user');
    if (!firstUserMsg) return;

    const userContent = firstUserMsg.content.substring(0, 200);
    const aiContent = assistantReply.substring(0, 200);

    try {
      const model = new ChatOpenAI({
        modelName: this.configService.openaiModel,
        openAIApiKey: this.configService.openaiApiKey,
        configuration: { baseURL: this.configService.openaiBaseUrl || undefined },
        maxTokens: 30,
        temperature: 0,
      });

      const result = await model.invoke([
        new SystemMessage(
          '根据以下对话内容生成一个简洁的标题（不超过15个中文字符）。要求：直接输出标题，不要任何解释、标点、引号。突出核心话题或意图。标题语言与对话语言一致。',
        ),
        new HumanMessage(`用户：${userContent}\nAI：${aiContent}`),
      ]);

      const title = (result.content as string).trim().replace(/[""''""。！？，、]/g, '');
      if (title && title.length > 0 && title.length <= 30) {
        await this.sessionRepo.update(sessionId, { title });
        console.log(`[ChatService] 标题已生成: "${title}" (session: ${sessionId.substring(0, 8)}...)`);
      }
    } catch (e) {
      // 标题生成失败不影响主流程，静默处理
      console.warn('[ChatService] 标题生成失败:', e instanceof Error ? e.message : e);
    }
  }
}
