import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEventEntity } from '../../common/entities/calendar-event.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CronJobModule } from '../cron-job/cron-job.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEventEntity]),
    forwardRef(() => CronJobModule),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
