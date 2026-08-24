import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
  NotificationType,
} from './schemas/notification.schema';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entity?: string | null;
  entityId?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  /** Best-effort write: notifying must never fail the business operation it's reporting on. */
  async create(input: CreateNotificationInput): Promise<void> {
    try {
      await this.notificationModel.create({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        entity: input.entity ?? null,
        entityId: input.entityId ?? null,
        isRead: false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create notification of type ${input.type} for user ${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  listForUser(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.notificationModel
      .find({ userId, ...(unreadOnly ? { isRead: false } : {}) })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({ userId, isRead: false });
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        { _id: id, userId },
        { isRead: true },
        { returnDocument: 'after' },
      )
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบการแจ้งเตือนนี้');
    }
    return updated;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationModel.updateMany(
      { userId, isRead: false },
      { isRead: true },
    );
  }
}
