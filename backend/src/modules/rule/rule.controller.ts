import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { RuleService } from './rule.service';
import { RuleEntity } from '../../common/entities/rule.entity';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Controller('api/v1/rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Get()
  async findAll(@Query('enabled_only') enabledOnly?: string): Promise<RuleEntity[]> {
    return this.ruleService.findAll(enabledOnly === 'true');
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<RuleEntity> {
    return this.ruleService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateRuleDto): Promise<RuleEntity> {
    return this.ruleService.create(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRuleDto): Promise<RuleEntity> {
    return this.ruleService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.ruleService.remove(id);
    return { message: 'Rule deleted' };
  }
}
