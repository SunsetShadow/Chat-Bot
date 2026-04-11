import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { MemoryEntity } from '../../common/entities/memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Controller('api/v1/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  async findAll(
    @Query('type') type?: string,
    @Query('min_importance') minImportance?: string,
  ): Promise<MemoryEntity[]> {
    const min = minImportance ? parseInt(minImportance, 10) : undefined;
    return this.memoryService.findAll(type, min);
  }

  @Get('search')
  async searchBySemantic(
    @Query('query') query: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const results = await this.memoryService.searchBySemantic(
      query,
      limit ? parseInt(limit, 10) : 10,
      type,
    );
    return { success: true, data: results, message: 'ok', code: 'SUCCESS' };
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<MemoryEntity> {
    return this.memoryService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateMemoryDto): Promise<MemoryEntity> {
    return this.memoryService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateMemoryDto): Promise<MemoryEntity> {
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.memoryService.remove(id);
    return { message: 'Memory deleted' };
  }
}
