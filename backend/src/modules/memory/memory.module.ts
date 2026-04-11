import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryEntity } from '../../common/entities/memory.entity';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { EmbeddingService } from './embedding.service';
import { MilvusService } from './milvus.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntity])],
  controllers: [MemoryController],
  providers: [MemoryService, EmbeddingService, MilvusService],
  exports: [MemoryService],
})
export class MemoryModule {}
