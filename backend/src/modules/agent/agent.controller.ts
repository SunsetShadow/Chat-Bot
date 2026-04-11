import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentEntity } from '../../common/entities/agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('api/v1/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  async findAll(): Promise<AgentEntity[]> {
    return this.agentService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<AgentEntity> {
    return this.agentService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateAgentDto): Promise<AgentEntity> {
    return this.agentService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAgentDto): Promise<AgentEntity> {
    return this.agentService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.agentService.remove(id);
    return { message: 'Agent deleted' };
  }
}
