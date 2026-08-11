import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type IngredientDocument = HydratedDocument<Ingredient>;

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

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const IngredientSchema = SchemaFactory.createForClass(Ingredient);
