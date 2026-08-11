import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SupplierDocument = HydratedDocument<Supplier>;

@Schema({ timestamps: true, collection: 'suppliers' })
export class Supplier {
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

  @Prop({ default: '' })
  contactName!: string;

  @Prop({ default: '' })
  phone!: string;

  @Prop({ default: '' })
  email!: string;

  @Prop({ default: '' })
  address!: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const SupplierSchema = SchemaFactory.createForClass(Supplier);
