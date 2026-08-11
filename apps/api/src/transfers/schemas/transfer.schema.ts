import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TransferDocument = HydratedDocument<Transfer>;

@Schema({ _id: false })
export class TransferItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  quantity!: number;

  @Prop({ required: true })
  unit!: string;
}

export const TransferItemSchema = SchemaFactory.createForClass(TransferItem);

export const TRANSFER_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

@Schema({ timestamps: true, collection: 'transfers' })
export class Transfer {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true,
  })
  fromZoneId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true,
  })
  toZoneId!: Types.ObjectId;

  @Prop({ enum: TRANSFER_STATUSES, default: 'PENDING', index: true })
  status!: TransferStatus;

  @Prop({ type: [TransferItemSchema], required: true })
  items!: TransferItem[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Requisition',
    default: null,
  })
  requisitionId!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  performedBy!: Types.ObjectId;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;
}

export const TransferSchema = SchemaFactory.createForClass(Transfer);
