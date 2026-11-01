import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PurchaseOrderDocument = HydratedDocument<PurchaseOrder>;

@Schema({ _id: false })
export class PurchaseOrderItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  orderedQuantity!: number;

  @Prop({ required: true, min: 0, default: 0 })
  receivedQuantity!: number;

  /** Unit code the line is ordered/received in (e.g. ลัง); orderedQuantity/receivedQuantity/unitCost use it. */
  @Prop({ required: true })
  unit!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit', default: null })
  unitId!: Types.ObjectId | null;

  /** 1 line unit = conversionFactor x the ingredient's base unit, frozen at order time. */
  @Prop({ default: 1, min: 0 })
  conversionFactor!: number;

  /** Cost per line unit (per ลัง when unit is ลัง). */
  @Prop({ required: true, min: 0 })
  unitCost!: number;
}

export const PurchaseOrderItemSchema =
  SchemaFactory.createForClass(PurchaseOrderItem);

export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/**
 * A Supplier order for ingredients (plan.md §30). Only receive() moves inventory -- into the
 * WAREHOUSE zone by default, or another zone flagged allowReceiving (see ZonesService).
 */
@Schema({ timestamps: true, collection: 'purchaseOrders' })
export class PurchaseOrder {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Supplier',
    required: true,
    index: true,
  })
  supplierId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: PURCHASE_ORDER_STATUSES,
    default: 'DRAFT',
    index: true,
  })
  status!: PurchaseOrderStatus;

  @Prop({ type: [PurchaseOrderItemSchema], required: true })
  items!: PurchaseOrderItem[];

  /** Default receiving zone (WAREHOUSE); a receive call may pick another zone that allows receiving. */
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Zone', required: true })
  deliveryZoneId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy!: Types.ObjectId;

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
  completedAt!: Date | null;

  @Prop({ type: String, default: null })
  remark!: string | null;
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);
PurchaseOrderSchema.index({ supplierId: 1, createdAt: -1 });
PurchaseOrderSchema.index({ status: 1, createdAt: -1 });
