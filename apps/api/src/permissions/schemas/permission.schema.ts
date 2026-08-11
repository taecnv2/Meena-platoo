import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PermissionDocument = HydratedDocument<Permission>;

@Schema({ timestamps: true, collection: 'permissions' })
export class Permission {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, index: true })
  module!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
