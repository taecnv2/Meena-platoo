import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ZoneStockDocument = HydratedDocument<ZoneStock>;

/**
 * Derived/read-optimized per-ingredient-per-zone quantity (plan.md §21). The source of
 * truth for "what happened" is StockMovement; this collection is maintained transactionally
 * alongside every movement write via InventoryService.increment/decrement.
 */
@Schema({
  timestamps: { createdAt: false, updatedAt: true },
  collection: 'zoneStocks',
})
export class ZoneStock {
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

  @Prop({ required: true, default: 0, min: 0 })
  quantity!: number;
}

export const ZoneStockSchema = SchemaFactory.createForClass(ZoneStock);
ZoneStockSchema.index({ ingredientId: 1, zoneId: 1 }, { unique: true });
