import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Controller('api/v1/notifications')
export class NotificationController {
  constructor(private notifService: NotificationService) {}

  @Get()
  async list(@Query('page') page?: string, @Query('per_page') perPage?: string) {
    return this.notifService.findAll(
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
    );
  }

  @Get('unread-count')
  async unreadCount() {
    const count = await this.notifService.getUnreadCount();
    return { success: true, data: { count } };
  }

  @Post(':id/read')
  async markRead(@Param('id') id: string) {
    await this.notifService.markAsRead(id);
    return { success: true };
  }

  @Post('read-all')
  async markAllRead() {
    await this.notifService.markAllRead();
    return { success: true };
  }
}
