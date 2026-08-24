import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type StockCountDocument = HydratedDocument<StockCount>;

@Schema({ _id: false })
export class StockCountItem {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  expectedQuantity!: number;

  @Prop({ required: true, min: 0 })
  actualQuantity!: number;

  /** actualQuantity - expectedQuantity, computed at creation time. */
  @Prop({ required: true })
  difference!: number;

  @Prop({ required: true })
  unit!: string;
}

export const StockCountItemSchema =
  SchemaFactory.createForClass(StockCountItem);

export const STOCK_COUNT_STATUSES = [
  'PENDING_APPROVAL',
  'APPROVED',
  'CANCELLED',
] as const;
export type StockCountStatus = (typeof STOCK_COUNT_STATUSES)[number];

/** Count -> difference -> review -> approve -> adjustment movement (plan.md §31). */
@Schema({ timestamps: true, collection: 'stockCounts' })
export class StockCount {
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
    type: String,
    enum: STOCK_COUNT_STATUSES,
    default: 'PENDING_APPROVAL',
    index: true,
  })
  status!: StockCountStatus;

  @Prop({ type: [StockCountItemSchema], required: true })
  items!: StockCountItem[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  countedBy!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  approvedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  approvedAt!: Date | null;
}

export const StockCountSchema = SchemaFactory.createForClass(StockCount);
StockCountSchema.index({ zoneId: 1, createdAt: -1 });
