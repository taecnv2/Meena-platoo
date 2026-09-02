import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

/** The tracked actions from plan.md §35. Not a DB-enforced enum -- `action` stays a free string
 * so future audited actions don't require a schema migration. */
export const AUDIT_ACTIONS = [
  'USER_CREATED',
  'USER_UPDATED',
  'ROLE_CHANGED',
  'PERMISSION_CHANGED',
  'ZONE_CREATED',
  'INGREDIENT_UPDATED',
  'REQUISITION_APPROVED',
  'TRANSFER_COMPLETED',
  'STOCK_ADJUSTED',
  'PURCHASE_RECEIVED',
  'WASTE_CREATED',
  'DATA_EXPORTED',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Append-only audit trail (plan.md §35). Written by AuditLogService.log(), called from
 * controllers/services after a tracked mutation succeeds. Never updated or deleted.
 */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'auditLogs',
})
export class AuditLog {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, index: true })
  action!: AuditAction;

  @Prop({ required: true, index: true })
  entity!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null, index: true })
  entityId!: Types.ObjectId | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  after!: Record<string, unknown> | null;

  @Prop({ type: String, default: null })
  remark!: string | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ createdAt: -1 });
