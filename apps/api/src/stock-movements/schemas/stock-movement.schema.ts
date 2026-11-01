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
  'PRODUCTION_IN',
  'PRODUCTION_OUT',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Movement types that add to a zone's stock (everything else in MOVEMENT_TYPES removes stock). */
export const IN_MOVEMENT_TYPES: MovementType[] = [
  'STOCK_IN',
  'TRANSFER_IN',
  'ADJUSTMENT_IN',
  'PRODUCTION_IN',
];
export const OUT_MOVEMENT_TYPES: MovementType[] = [
  'STOCK_OUT',
  'TRANSFER_OUT',
  'ADJUSTMENT_OUT',
  'WASTE',
  'PRODUCTION_OUT',
  'AUTO_DEDUCTION',
];

export const REFERENCE_TYPES = [
  'STOCK_IN',
  'STOCK_OUT',
  'TRANSFER',
  'ADJUSTMENT',
  'STOCK_COUNT',
  'WASTE',
  'PURCHASE_ORDER',
  'MANUAL',
  'PRODUCTION',
  'IMPORT',
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

/** Why stock left a zone on a manual Stock Out -- stored in StockMovement.reason. */
export const STOCK_OUT_REASONS = [
  'KITCHEN_USE',
  'SALE',
  'STAFF_MEAL',
  'COMPLIMENTARY',
  'OTHER',
] as const;
export type StockOutReason = (typeof STOCK_OUT_REASONS)[number];

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

  @Prop({ type: String, enum: MOVEMENT_TYPES, required: true, index: true })
  movementType!: MovementType;

  @Prop({ type: String, enum: REFERENCE_TYPES, required: true })
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

  /** What the user actually keyed in (e.g. 2 ลัง) before conversion to `quantity` in the base unit. */
  @Prop({ type: Number, default: null })
  inputQuantity!: number | null;

  @Prop({ type: String, default: null })
  inputUnit!: string | null;

  /** Optional measured weight in kg, recorded alongside a count-based quantity. */
  @Prop({ type: Number, default: null, min: 0 })
  weight!: number | null;

  /** Who delivered the goods (STOCK_IN only) -- feeds the supplier billing statement. */
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Supplier',
    default: null,
    index: true,
  })
  supplierId!: Types.ObjectId | null;

  @Prop({ type: String, default: null })
  invoiceNo!: string | null;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
StockMovementSchema.index({ ingredientId: 1, createdAt: -1 });
StockMovementSchema.index({ zoneId: 1, createdAt: -1 });
StockMovementSchema.index({ movementType: 1, createdAt: -1 });
StockMovementSchema.index({ supplierId: 1, createdAt: -1 });
