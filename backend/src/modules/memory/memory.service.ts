import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEntity, MemoryType } from '../../common/entities/memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { EmbeddingService } from './embedding.service';
import { MilvusService } from './milvus.service';

@Injectable()
export class MemoryService implements OnModuleInit {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectRepository(MemoryEntity)
    private memoryRepo: Repository<MemoryEntity>,
    private embeddingService: EmbeddingService,
    private milvusService: MilvusService,
  ) {}

  async onModuleInit() {
    // 每 24 小时执行一次巡检（首次延迟 5 分钟，避免启动时立即执行）
    setTimeout(() => {
      this.runMaintenance().catch((err) => {
        this.logger.warn(`Memory maintenance failed: ${err.message}`);
      });
      setInterval(() => {
        this.runMaintenance().catch((err) => {
          this.logger.warn(`Memory maintenance failed: ${err.message}`);
        });
      }, 24 * 60 * 60 * 1000);
    }, 5 * 60 * 1000);
    this.logger.log('Memory maintenance scheduler initialized (every 24h)');
  }

  async findAll(type?: string, minImportance?: number, agentId?: string): Promise<MemoryEntity[]> {
    const qb = this.memoryRepo.createQueryBuilder('m');

    if (type) {
      qb.andWhere('m.type = :type', { type });
    }
    if (minImportance) {
      qb.andWhere('m.importance >= :minImportance', { minImportance });
    }
    if (agentId) {
      qb.andWhere('(m.agent_id = :agentId OR m.agent_id IS NULL)', { agentId });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<MemoryEntity> {
    const memory = await this.memoryRepo.findOneBy({ id });
    if (!memory) {
      throw new NotFoundException(`Memory ${id} not found`);
    }
    return memory;
  }

  async create(dto: CreateMemoryDto): Promise<MemoryEntity> {
    const memory = this.memoryRepo.create({
      id: uuidv4(),
      content: dto.content,
      type: dto.type || MemoryType.FACT,
      source_session_id: dto.source_session_id || undefined,
      agent_id: dto.agent_id || undefined,
      importance: dto.importance || 5,
      last_accessed: new Date(),
    });
    const saved = await this.memoryRepo.save(memory);

    // Write to Milvus (failure does not block)
    try {
      const embedding = await this.embeddingService.embedQuery(dto.content);
      await this.milvusService.insert(saved.id, embedding, saved.type);
    } catch (error) {
      this.logger.warn(`Failed to index memory ${saved.id} in Milvus: ${error.message}`);
    }

    return saved;
  }

  async update(id: string, dto: UpdateMemoryDto): Promise<MemoryEntity> {
    const memory = await this.findOne(id);
    Object.assign(memory, {
      ...dto,
      last_accessed: new Date(),
    });
    const saved = await this.memoryRepo.save(memory);

    // Re-generate embedding if content changed
    if (dto.content) {
      try {
        await this.milvusService.delete(id);
        const embedding = await this.embeddingService.embedQuery(dto.content);
        await this.milvusService.insert(id, embedding, saved.type);
      } catch (error) {
        this.logger.warn(`Failed to re-index memory ${id} in Milvus: ${error.message}`);
      }
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.memoryRepo.delete(id);

    try {
      await this.milvusService.delete(id);
    } catch (error) {
      this.logger.warn(`Failed to delete memory ${id} from Milvus: ${error.message}`);
    }
  }

  async buildMemoryContext(_sessionId?: string, agentId?: string, topK = 20): Promise<string> {
    const qb = this.memoryRepo.createQueryBuilder('m')
      .where('m.archived = :archived', { archived: false });

    if (agentId) {
      qb.andWhere('(m.agent_id = :agentId OR m.agent_id IS NULL)', { agentId });
    }

    qb.orderBy('m.importance', 'DESC').limit(topK);

    const sorted = await qb.getMany();
    if (sorted.length === 0) return '';

    const typeLabel: Record<string, string> = {
      [MemoryType.FACT]: '事实',
      [MemoryType.PREFERENCE]: '偏好',
      [MemoryType.EVENT]: '事件',
    };

    const lines = sorted.map((m) => `- [${typeLabel[m.type] || m.type}] ${m.content}`);
    return `以下是关于用户的已知信息：\n${lines.join('\n')}`;
  }

  /**
   * Semantic search: find similar memories via embedding
   */
  async searchBySemantic(query: string, limit = 10, memoryType?: string): Promise<MemoryEntity[]> {
    const embedding = await this.embeddingService.embedQuery(query);
    const ids = await this.milvusService.search(embedding, limit, memoryType);

    if (ids.length === 0) return [];

    const memories = await this.memoryRepo.findBy({ id: In(ids) });

    // Sort by Milvus similarity order
    const idOrder = new Map(ids.map((id, index) => [id, index]));
    return memories.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);
  }

  /**
   * 定期巡检：降权长期未被召回的记忆，归档过期记忆
   */
  async runMaintenance(): Promise<{ demoted: number; archived: number }> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const hundredEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const demoteResult = await this.memoryRepo
      .createQueryBuilder()
      .update(MemoryEntity)
      .set({ importance: () => 'GREATEST(importance - 1, 0)' })
      .where('last_accessed < :date', { date: ninetyDaysAgo })
      .andWhere('importance > 0')
      .andWhere('archived = false')
      .execute();

    const archiveResult = await this.memoryRepo
      .createQueryBuilder()
      .update(MemoryEntity)
      .set({ archived: true })
      .where('importance = 0')
      .andWhere('created_at < :date', { date: hundredEightyDaysAgo })
      .andWhere('archived = false')
      .execute();

    this.logger.log(`Memory maintenance: demoted=${demoteResult.affected}, archived=${archiveResult.affected}`);

    return {
      demoted: demoteResult.affected || 0,
      archived: archiveResult.affected || 0,
    };
  }

  /** 每个会话最多提取的记忆数 */
  private static readonly MAX_MEMORIES_PER_SESSION = 5;
  private sessionMemoryCount = new Map<string, number>();

  /** 检查并记录会话记忆写入计数，返回是否允许写入 */
  checkSessionLimit(sessionId: string): boolean {
    const current = this.sessionMemoryCount.get(sessionId) || 0;
    if (current >= MemoryService.MAX_MEMORIES_PER_SESSION) return false;
    this.sessionMemoryCount.set(sessionId, current + 1);
    return true;
  }

  /** 重置会话计数 */
  resetSessionLimit(sessionId: string): void {
    this.sessionMemoryCount.delete(sessionId);
  }
}
