import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UnitDocument = HydratedDocument<Unit>;

export const UNIT_TYPES = ['WEIGHT', 'VOLUME', 'COUNT', 'OTHER'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

@Schema({ timestamps: true, collection: 'units' })
export class Unit {
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

  @Prop({ enum: UNIT_TYPES, required: true })
  type!: UnitType;

  /** Multiplier relative to the base unit of the same type. Real conversion math is deferred past P0. */
  @Prop({ default: 1 })
  conversionFactor!: number;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const UnitSchema = SchemaFactory.createForClass(Unit);
