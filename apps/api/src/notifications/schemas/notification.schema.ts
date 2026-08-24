import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export const NOTIFICATION_TYPES = [
  'REQUISITION_APPROVED',
  'REQUISITION_REJECTED',
  'PURCHASE_APPROVED',
  'PURCHASE_REJECTED',
  'WASTE_APPROVED',
  'WASTE_REJECTED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** In-app notification, always addressed to a single user (plan.md P1 "Notification"). */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'notifications',
})
export class Notification {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  type!: NotificationType;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ type: String, default: null })
  entity!: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  entityId!: Types.ObjectId | null;

  @Prop({ default: false, index: true })
  isRead!: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
