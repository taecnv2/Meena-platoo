import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ZoneDocument = HydratedDocument<Zone>;

export const ZONE_TYPES = [
  'KITCHEN',
  'FRONT_OF_HOUSE',
  'STORAGE',
  'COLD_STORAGE',
  'OTHER',
] as const;
export type ZoneType = (typeof ZONE_TYPES)[number];

@Schema({ timestamps: true, collection: 'zones' })
export class Zone {
  @Prop({ required: true, index: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  code!: string;

  @Prop({ type: String, enum: ZONE_TYPES, required: true })
  type!: ZoneType;

  @Prop({ default: '' })
  description!: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const ZoneSchema = SchemaFactory.createForClass(Zone);
