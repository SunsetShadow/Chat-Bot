import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { AgentService, Agent } from './agent.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

@Controller('api/v1/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  findAll(): Agent[] {
    return this.agentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Agent {
    return this.agentService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateAgentDto): Agent {
    return this.agentService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgentDto): Agent {
    return this.agentService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.agentService.remove(id);
    return { message: 'Agent deleted' };
  }
}
