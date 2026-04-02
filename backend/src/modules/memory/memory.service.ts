import { Injectable, NotFoundException } from '@nestjs/common';
import { generateId, getCurrentTimestamp } from '../../common/types';
import { CreateMemoryDto, MemoryType } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

export interface Memory {
  id: string;
  content: string;
  type: MemoryType;
  source_session_id: string | null;
  importance: number;
  created_at: Date;
  last_accessed: Date;
}

@Injectable()
export class MemoryService {
  private memories = new Map<string, Memory>();

  findAll(type?: string, minImportance?: number): Memory[] {
    let result = Array.from(this.memories.values());
    if (type) {
      result = result.filter((m) => m.type === type);
    }
    if (minImportance) {
      result = result.filter((m) => m.importance >= minImportance);
    }
    return result;
  }

  findOne(id: string): Memory {
    const memory = this.memories.get(id);
    if (!memory) {
      throw new NotFoundException(`Memory ${id} not found`);
    }
    return memory;
  }

  create(dto: CreateMemoryDto): Memory {
    const memory: Memory = {
      id: generateId(),
      content: dto.content,
      type: dto.type || MemoryType.FACT,
      source_session_id: dto.source_session_id || null,
      importance: dto.importance || 5,
      created_at: getCurrentTimestamp(),
      last_accessed: getCurrentTimestamp(),
    };
    this.memories.set(memory.id, memory);
    return memory;
  }

  update(id: string, dto: UpdateMemoryDto): Memory {
    const memory = this.findOne(id);
    Object.assign(memory, {
      ...dto,
      last_accessed: getCurrentTimestamp(),
    });
    this.memories.set(id, memory);
    return memory;
  }

  remove(id: string): void {
    const memory = this.findOne(id);
    this.memories.delete(id);
  }

  buildMemoryContext(sessionId?: string): string {
    const all = this.findAll().sort((a, b) => b.importance - a.importance);
    if (all.length === 0) return '';

    const typeLabel: Record<string, string> = {
      [MemoryType.FACT]: '事实',
      [MemoryType.PREFERENCE]: '偏好',
      [MemoryType.EVENT]: '事件',
    };

    const lines = all.map((m) => `- [${typeLabel[m.type] || m.type}] ${m.content}`);
    return `以下是关于用户的已知信息：\n${lines.join('\n')}`;
  }
}
