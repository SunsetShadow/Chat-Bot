import { Controller, Get, Param, Post, Delete, NotFoundException } from '@nestjs/common';
import { SkillService } from './skill.service';

@Controller('api/v1/skills')
export class SkillController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  async findAll() {
    const data = await this.skillService.findAllSummary();
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const skill = await this.skillService.findOneSummary(id);
    if (!skill) throw new NotFoundException(`Skill ${id} not found`);
    return { success: true, data: skill };
  }

  @Post('refresh')
  async refresh() {
    await this.skillService.refresh();
    return { success: true, data: { message: 'Skills refreshed' } };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const ok = await this.skillService.delete(id);
    if (!ok) throw new NotFoundException(`Skill ${id} not found or cannot be deleted`);
    return { success: true, data: { message: `Skill ${id} deleted` } };
  }
}
