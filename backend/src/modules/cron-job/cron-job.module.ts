import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobEntity } from '../../common/entities/job.entity';
import { JobExecutionEntity } from '../../common/entities/job-execution.entity';
import { NotificationEntity } from '../../common/entities/notification.entity';
import { JobService } from './job.service';
import { JobExecutionService } from './job-execution.service';
import { NotificationService } from './notification.service';
import { CronJobController } from './cron-job.controller';
import { NotificationController } from './notification.controller';
import { LangGraphModule } from '../langgraph/langgraph.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, JobExecutionEntity, NotificationEntity]),
    forwardRef(() => LangGraphModule),
  ],
  controllers: [CronJobController, NotificationController],
  providers: [JobService, JobExecutionService, NotificationService],
  exports: [JobService, NotificationService],
})
export class CronJobModule {}
