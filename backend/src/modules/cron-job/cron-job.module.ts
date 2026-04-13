import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from '../../common/entities/job.entity';
import { JobExecutionEntity } from '../../common/entities/job-execution.entity';
import { JobService } from './job.service';
import { JobExecutionService } from './job-execution.service';
import { CronJobController } from './cron-job.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, JobExecutionEntity]),
    forwardRef(() => ChatModule),
  ],
  controllers: [CronJobController],
  providers: [JobService, JobExecutionService],
  exports: [JobService],
})
export class CronJobModule {}
