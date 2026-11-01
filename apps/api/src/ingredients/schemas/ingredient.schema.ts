import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type IngredientDocument = HydratedDocument<Ingredient>;

/** An extra unit this ingredient can be counted in: 1 `unitId` = `factor` x base unit (1 ลัง = 12 ขวด). */
@Schema({ _id: false })
export class IngredientUnitConversion {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit', required: true })
  unitId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  factor!: number;
}

export const IngredientUnitConversionSchema = SchemaFactory.createForClass(
  IngredientUnitConversion,
);

@Schema({ timestamps: true, collection: 'ingredients' })
export class Ingredient {
  @Prop({
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  code!: string;

  @Prop({ required: true, index: true, trim: true })
  name!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  categoryId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit', required: true })
  baseUnitId!: Types.ObjectId;

  @Prop({ default: 0, min: 0 })
  minimumStock!: number;

  @Prop({ default: 0, min: 0 })
  maximumStock!: number;

  @Prop({ default: 0, min: 0 })
  defaultCost!: number;

  @Prop({ default: '' })
  description!: string;

  /** Stock is always stored in baseUnitId; these let staff enter quantities in packs/cases/bags. */
  @Prop({ type: [IngredientUnitConversionSchema], default: [] })
  unitConversions!: IngredientUnitConversion[];

  /** Free-form secondary labels (e.g. "portion", "พนักงาน") on top of the single categoryId. */
  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  /** Set for consignment stock owned by a third party (e.g. "ไวน์พี่มี่"); null = restaurant-owned. */
  @Prop({ type: String, default: null, index: true })
  consignmentOwner!: string | null;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const IngredientSchema = SchemaFactory.createForClass(Ingredient);
