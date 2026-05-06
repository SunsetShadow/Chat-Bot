import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { SkillService } from './skill.service';
import { SkillScanService } from './skill-scan.service';
import { SkillApprovalService } from './skill-approval.service';
import { SkillUsageService } from './skill-usage.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [forwardRef(() => SettingsModule)],
  controllers: [SkillController],
  providers: [SkillService, SkillScanService, SkillApprovalService, SkillUsageService],
  exports: [SkillService, SkillApprovalService, SkillUsageService],
})
export class SkillModule implements OnModuleInit {
  constructor(private readonly approvalService: SkillApprovalService) {}

  async onModuleInit() {
    await this.approvalService.onModuleInit();
  }
}
