import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('api/v1/calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get('events')
  async listEvents(
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    const events = await this.calendarService.listEvents(timeMin, timeMax);
    return { success: true, data: events };
  }

  @Get('search')
  async searchEvents(@Query('q') q: string) {
    const events = await this.calendarService.searchEvents(q);
    return { success: true, data: events };
  }

  @Get('cron-events')
  async getCronJobEvents(
    @Query('timeMin') timeMin: string,
    @Query('timeMax') timeMax: string,
  ) {
    const events = await this.calendarService.getCronJobEvents(timeMin, timeMax);
    return { success: true, data: events };
  }

  @Get('events/:id')
  async getEvent(@Param('id') id: string) {
    const event = await this.calendarService.getEvent(id);
    return { success: true, data: event };
  }

  @Post('events')
  async createEvent(@Body() dto: CreateEventDto) {
    const event = await this.calendarService.createEvent(dto);
    return { success: true, data: event };
  }

  @Patch('events/:id')
  async updateEvent(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.calendarService.updateEvent(id, dto);
    return { success: true, data: event };
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    await this.calendarService.deleteEvent(id);
    return { success: true };
  }
}
