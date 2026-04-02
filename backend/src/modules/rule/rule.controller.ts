import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { RuleService, Rule } from './rule.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

@Controller('api/v1/rules')
export class RuleController {
  constructor(private readonly ruleService: RuleService) {}

  @Get()
  findAll(@Query('enabled_only') enabledOnly?: string): Rule[] {
    return this.ruleService.findAll(enabledOnly === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string): Rule {
    return this.ruleService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRuleDto): Rule {
    return this.ruleService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRuleDto): Rule {
    return this.ruleService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    this.ruleService.remove(id);
    return { message: 'Rule deleted' };
  }
}
