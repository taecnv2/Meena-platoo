import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/authenticated-request';
import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('unreadOnly') unreadOnly?: string,
  ): Promise<Notification[]> {
    return this.notificationsService.listForUser(
      user.id,
      unreadOnly === 'true',
    );
  }

  @Get('unread-count')
  countUnread(@CurrentUser() user: RequestUser): Promise<{ count: number }> {
    return this.notificationsService
      .countUnread(user.id)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Notification> {
    return this.notificationsService.markRead(id, user.id);
  }

  @Patch('read-all')
  async markAllRead(
    @CurrentUser() user: RequestUser,
  ): Promise<{ success: true }> {
    await this.notificationsService.markAllRead(user.id);
    return { success: true };
  }
}
