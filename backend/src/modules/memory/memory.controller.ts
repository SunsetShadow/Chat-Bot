import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { MemoryService, Memory } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Controller('api/v1/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  findAll(
    @Query('type') type?: string,
    @Query('min_importance') minImportance?: string,
  ): Memory[] {
    const min = minImportance ? parseInt(minImportance, 10) : undefined;
    return this.memoryService.findAll(type, min);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Memory {
    return this.memoryService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateMemoryDto): Memory {
    return this.memoryService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMemoryDto): Memory {
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.memoryService.remove(id);
    return { message: 'Memory deleted' };
  }
}
