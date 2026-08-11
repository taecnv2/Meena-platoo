import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  username!: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  })
  email!: string;

  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Role',
    required: true,
    index: true,
  })
  roleId!: Types.ObjectId;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Zone' }],
    default: [],
  })
  zoneIds!: Types.ObjectId[];

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
