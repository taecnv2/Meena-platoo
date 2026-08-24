import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type WasteDocument = HydratedDocument<Waste>;

export const WASTE_REASONS = [
  'EXPIRED',
  'SPOILED',
  'DAMAGED',
  'OVER_PREPARED',
  'WRONG_PREPARATION',
  'CUSTOMER_RETURN',
  'OTHER',
] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

export const WASTE_STATUSES = [
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
] as const;
export type WasteStatus = (typeof WASTE_STATUSES)[number];

/**
 * A waste record (plan.md §32). Staff report waste; stock only decreases (and a
 * StockMovement is written) once a manager approves it (plan.md §33 role matrix --
 * WASTE_CREATE and WASTE_APPROVE are held by different roles).
 */
@Schema({ timestamps: true, collection: 'waste' })
export class Waste {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true,
  })
  zoneId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
    index: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  quantity!: number;

  @Prop({ required: true })
  unit!: string;

  @Prop({ type: String, enum: WASTE_REASONS, required: true })
  reason!: WasteReason;

  /** Ingredient defaultCost snapshotted at report time, used for pre-approval value estimates. */
  @Prop({ required: true, min: 0 })
  unitCost!: number;

  @Prop({
    type: String,
    enum: WASTE_STATUSES,
    default: 'PENDING_APPROVAL',
    index: true,
  })
  status!: WasteStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reportedBy!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  rejectedBy!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  rejectionReason!: string | null;

  @Prop({ type: String, default: null })
  remark!: string | null;
}

export const WasteSchema = SchemaFactory.createForClass(Waste);
WasteSchema.index({ zoneId: 1, createdAt: -1 });
WasteSchema.index({ status: 1, createdAt: -1 });
