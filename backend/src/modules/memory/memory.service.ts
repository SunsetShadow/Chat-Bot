import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEntity, MemoryType } from '../../common/entities/memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { EmbeddingService } from './embedding.service';
import { MilvusService } from './milvus.service';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectRepository(MemoryEntity)
    private memoryRepo: Repository<MemoryEntity>,
    private embeddingService: EmbeddingService,
    private milvusService: MilvusService,
  ) {}

  async findAll(type?: string, minImportance?: number): Promise<MemoryEntity[]> {
    const qb = this.memoryRepo.createQueryBuilder('m');

    if (type) {
      qb.andWhere('m.type = :type', { type });
    }
    if (minImportance) {
      qb.andWhere('m.importance >= :minImportance', { minImportance });
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

  async buildMemoryContext(sessionId?: string): Promise<string> {
    const all = await this.findAll();
    const sorted = all.sort((a, b) => b.importance - a.importance);
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
}
