import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type ProductionBatchDocument = HydratedDocument<ProductionBatch>;

/** One side of a production batch. Quantities are in the ingredient's base unit; input* is what was keyed in. */
@Schema({ _id: false })
export class ProductionLine {
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

  @Prop({ required: true, min: 0 })
  inputQuantity!: number;

  @Prop({ required: true })
  inputUnit!: string;

  /** Output lines only: grams per entered unit, used to split the raw cost by weight. */
  @Prop({ type: Number, default: null })
  portionWeight!: number | null;

  /** Cost per base unit. */
  @Prop({ required: true, min: 0 })
  unitCost!: number;

  @Prop({ required: true, min: 0 })
  totalCost!: number;
}

export const ProductionLineSchema =
  SchemaFactory.createForClass(ProductionLine);

/**
 * Converting a raw ingredient into portioned items inside one zone (e.g. 4.9 kg salmon ->
 * 10 bags ดอง + 9 bags ซาชิมิ). The raw quantity leaves as PRODUCTION_OUT and each output
 * enters as PRODUCTION_IN, all in one transaction; the raw cost is split across outputs.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'productionBatches',
})
export class ProductionBatch {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Zone',
    required: true,
    index: true,
  })
  zoneId!: Types.ObjectId;

  @Prop({ type: ProductionLineSchema, required: true })
  input!: ProductionLine;

  @Prop({ type: [ProductionLineSchema], required: true })
  outputs!: ProductionLine[];

  /** Trim/scrap recorded for yield tracking, in the input's entered unit. Informational only. */
  @Prop({ type: Number, default: null })
  wasteQuantity!: number | null;

  /** Output weight / input weight x 100, when both can be expressed in kg. */
  @Prop({ type: Number, default: null })
  yieldPercent!: number | null;

  @Prop({ required: true, min: 0 })
  totalCost!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  performedBy!: Types.ObjectId;

  @Prop({ type: String, default: null })
  remark!: string | null;
}

export const ProductionBatchSchema =
  SchemaFactory.createForClass(ProductionBatch);
ProductionBatchSchema.index({ zoneId: 1, createdAt: -1 });
