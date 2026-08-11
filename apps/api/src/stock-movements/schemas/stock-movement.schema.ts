import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type StockMovementDocument = HydratedDocument<StockMovement>;

export const MOVEMENT_TYPES = [
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'WASTE',
  'AUTO_DEDUCTION',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const REFERENCE_TYPES = [
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER',
  'ADJUSTMENT',
  'STOCK_COUNT',
  'WASTE',
  'MANUAL',
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

/**
 * Append-only audit trail (plan.md §23). No update/delete route is ever exposed on this
 * collection -- the only writer is StockMovementsService.record(), called internally by
 * inventory/transfers/requisitions/stock-counts.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'stockMovements',
})
export class StockMovement {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Ingredient',
    required: true,
    index: true,
  })
  ingredientId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true,
  })
  zoneId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  quantity!: number;

  @Prop({ required: true })
  unit!: string;

  @Prop({ enum: MOVEMENT_TYPES, required: true, index: true })
  movementType!: MovementType;

  @Prop({ enum: REFERENCE_TYPES, required: true })
  referenceType!: ReferenceType;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null, index: true })
  referenceId!: Types.ObjectId | null;

  @Prop({ default: 0 })
  unitCost!: number;

  @Prop({ default: 0 })
  totalCost!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  performedBy!: Types.ObjectId;

  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({ type: String, default: null })
  remark!: string | null;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
StockMovementSchema.index({ ingredientId: 1, createdAt: -1 });
StockMovementSchema.index({ zoneId: 1, createdAt: -1 });
StockMovementSchema.index({ movementType: 1, createdAt: -1 });
