import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type RequisitionDocument = HydratedDocument<Requisition>;

@Schema({ _id: false })
export class RequisitionItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  requestedQuantity!: number;

  @Prop({ required: true, min: 0 })
  approvedQuantity!: number;

  @Prop({ required: true, min: 0, default: 0 })
  fulfilledQuantity!: number;

  @Prop({ required: true })
  unit!: string;

  @Prop({ required: true, default: 0 })
  unitCost!: number;
}

export const RequisitionItemSchema =
  SchemaFactory.createForClass(RequisitionItem);

export const REQUISITION_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'REJECTED',
  'CANCELLED',
] as const;
export type RequisitionStatus = (typeof REQUISITION_STATUSES)[number];

/**
 * A Zone requesting ingredients (plan.md §24). Never mutates ZoneStock directly --
 * fulfillment creates a Transfer, which is what actually moves inventory (§22 Rules 2/3).
 */
@Schema({ timestamps: true, collection: 'requisitions' })
export class Requisition {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  /** Zone the requester expects to fulfill from (plan.md §24 example). Fulfillment may specify a different zone. */
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

  @Prop({ enum: REQUISITION_STATUSES, default: 'PENDING', index: true })
  status!: RequisitionStatus;

  @Prop({ type: [RequisitionItemSchema], required: true })
  items!: RequisitionItem[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  requestedBy!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedBy!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  rejectedBy!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  rejectionReason!: string | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  cancelledBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;

  @Prop({ type: Date, default: null })
  fulfilledAt!: Date | null;
}

export const RequisitionSchema = SchemaFactory.createForClass(Requisition);
RequisitionSchema.index({ fromZoneId: 1, createdAt: -1 });
RequisitionSchema.index({ toZoneId: 1, createdAt: -1 });
RequisitionSchema.index({ status: 1, createdAt: -1 });
