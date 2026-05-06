import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException, Delete } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillApprovalService } from './skill-approval.service';

@Controller('api/v1/skills')
export class SkillController {
  constructor(
    private readonly skillService: SkillService,
    private readonly approvalService: SkillApprovalService,
  ) {}

  @Get()
  async findAll() {
    const data = await this.skillService.findAllSummary();
    return { success: true, data };
  }

  @Get('approvals/pending')
  async listPendingApprovals() {
    const data = this.approvalService.listPending();
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

  @Post('approvals/:id/approve')
  async approveSkill(@Param('id') id: string) {
    const result = await this.approvalService.approve(id);
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, data: { message: result.message } };
  }

  @Post('approvals/:id/reject')
  async rejectSkill(@Param('id') id: string) {
    const result = await this.approvalService.reject(id);
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, data: { message: result.message } };
  }

  @Get('approvals/:name/history')
  async getApprovalHistory(@Param('name') name: string) {
    const data = this.approvalService.getHistory(name);
    return { success: true, data };
  }

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    const data = await this.skillService.getUsage(id);
    if (!data) throw new NotFoundException(`Skill ${id} usage not found`);
    return { success: true, data };
  }
}
