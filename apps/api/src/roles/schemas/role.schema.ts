import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @Prop({ required: true, unique: true, index: true })
  name!: string;

  @Prop({ default: '' })
  description!: string;

  /** Permission codes granted to this role (plan.md §12: role references permission codes). */
  @Prop({ type: [String], default: [] })
  permissions!: string[];

  /** True only for OWNER: bypasses ZoneScopeGuard entirely instead of hard-coding role-name checks. */
  @Prop({ default: false })
  allZoneAccess!: boolean;

  @Prop({ enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status!: 'ACTIVE' | 'INACTIVE';
}

export const RoleSchema = SchemaFactory.createForClass(Role);
