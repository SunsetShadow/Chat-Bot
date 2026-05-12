import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { TokenUsageService } from './token-usage.service';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/v1/chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  @Post('completions')
  async createCompletion(
    @Body() dto: CreateCompletionDto,
    @Res() res: Response,
  ) {
    const result = await this.chatService.createCompletion(dto);

    if (result.stream) {
      this.handleSseStream(result, res, result.agent_id, dto.tts_session_id);
      return;
    }

    res.json({
      success: true,
      data: {
        session_id: result.session!.id,
        message: result.assistantMessage,
        finish_reason: result.finish_reason,
      },
    });
  }

  private handleSseStream(
    result: { session: any; messages: any[]; systemPrompt: string; agent_id?: string },
    res: Response,
    preferredAgent?: string,
    ttsSessionId?: string,
  ) {
    const messageId = uuidv4();
    const { session, messages, systemPrompt } = result;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let aborted = false;

    res.on('close', () => {
      aborted = true;
    });

    // 心跳：每 15s 发送一次，保持连接活跃
    const heartbeat = setInterval(() => {
      if (aborted) {
        clearInterval(heartbeat);
        return;
      }
      res.write('event: heartbeat\ndata: {}\n\n');
    }, 15_000);

    // 全局超时：120s
    const streamTimeout = setTimeout(() => {
      if (!aborted) {
        res.write(
          `event: timeout\ndata: ${JSON.stringify({ code: 'STREAM_TIMEOUT' })}\n\n`,
        );
        aborted = true;
        clearInterval(heartbeat);
        res.end();
      }
    }, 120_000);

    const streamGen = this.chatService.streamCompletion(
      messages,
      systemPrompt,
      session.id,
      messageId,
      preferredAgent,
      ttsSessionId,
    );

    const process = async () => {
      try {
        for await (const event of streamGen) {
          if (aborted) break;
          res.write(
            `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
          );
          if (event.event === 'done' || event.event === 'error') break;
        }
      } catch (err) {
        if (!aborted) {
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: err.message, code: 'STREAM_ERROR' })}\n\n`,
          );
        }
      } finally {
        clearInterval(heartbeat);
        clearTimeout(streamTimeout);
        res.end();
      }
    };

    process();
  }

  @Post('sessions')
  async createSession(@Body() dto: CreateSessionDto) {
    return this.chatService.createSession(dto);
  }

  @Get('sessions')
  async getSessions(
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    const p = page ? parseInt(page, 10) : 1;
    const ps = pageSize ? parseInt(pageSize, 10) : 20;
    const result = await this.chatService.getSessions(p, ps);
    return { data: result.data, pagination: result.pagination };
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.chatService.getSession(id);
  }

  @Put('sessions/:id/pin')
  async togglePin(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.chatService.togglePin(id, dto);
  }

  @Get('sessions/:id/messages')
  async getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  @Delete('sessions/:id')
  async deleteSession(@Param('id') id: string) {
    await this.chatService.deleteSession(id);
    return { success: true };
  }

  @Get('usage')
  async getUsage(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('group_by') groupBy?: 'model' | 'agent' | 'day',
  ) {
    return this.tokenUsageService.getStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy: groupBy || 'model',
    });
  }
}
