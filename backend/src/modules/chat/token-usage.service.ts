import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TokenUsageEntity } from '../../common/entities/token-usage.entity';

/** 各模型每 1M tokens 单价（USD） */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'qwen-max': { input: 2.4, output: 9.6 },
  'qwen-plus': { input: 0.8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

@Injectable()
export class TokenUsageService {
  constructor(
    @InjectRepository(TokenUsageEntity)
    private usageRepo: Repository<TokenUsageEntity>,
  ) {}

  /** 计算估算成本（USD） */
  calculateCost(modelName: string, promptTokens: number, completionTokens: number): number | null {
    const pricing = MODEL_PRICING[modelName];
    if (!pricing) return null;
    return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
  }

  /** 记录一次 token 使用 */
  async record(params: {
    sessionId: string;
    agentId?: string;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<TokenUsageEntity> {
    const totalTokens = params.promptTokens + params.completionTokens;
    const estimatedCost = this.calculateCost(params.modelName, params.promptTokens, params.completionTokens);

    const entity = this.usageRepo.create({
      id: uuidv4(),
      session_id: params.sessionId,
      agent_id: params.agentId || undefined,
      model_name: params.modelName,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost ?? undefined,
    });

    return this.usageRepo.save(entity);
  }

  /** 聚合查询：按时间范围统计 */
  async getStats(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'model' | 'agent' | 'day';
  }) {
    const qb = this.usageRepo.createQueryBuilder('u');

    if (params.startDate) {
      qb.andWhere('u.created_at >= :startDate', { startDate: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('u.created_at < :endDate', { endDate: params.endDate });
    }

    const groupBy = params.groupBy || 'model';

    if (groupBy === 'model') {
      qb.select('u.model_name', 'model_name')
        .addSelect('SUM(u.prompt_tokens)', 'total_prompt_tokens')
        .addSelect('SUM(u.completion_tokens)', 'total_completion_tokens')
        .addSelect('SUM(u.total_tokens)', 'total_tokens')
        .addSelect('SUM(u.estimated_cost)', 'total_cost')
        .addSelect('COUNT(u.id)', 'request_count')
        .groupBy('u.model_name')
        .orderBy('total_tokens', 'DESC');
    } else if (groupBy === 'agent') {
      qb.select('u.agent_id', 'agent_id')
        .addSelect('SUM(u.total_tokens)', 'total_tokens')
        .addSelect('SUM(u.estimated_cost)', 'total_cost')
        .addSelect('COUNT(u.id)', 'request_count')
        .groupBy('u.agent_id')
        .orderBy('total_tokens', 'DESC');
    } else if (groupBy === 'day') {
      qb.select("DATE(u.created_at)", 'date')
        .addSelect('SUM(u.total_tokens)', 'total_tokens')
        .addSelect('SUM(u.estimated_cost)', 'total_cost')
        .addSelect('COUNT(u.id)', 'request_count')
        .groupBy('date')
        .orderBy('date', 'ASC');
    }

    return qb.getRawMany();
  }
}
