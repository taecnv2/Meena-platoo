import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type SessionDocument = HydratedDocument<Session>;

/** Revocable refresh-token session (plan.md §5, §8). Never stores the raw refresh token, only its hash. */
@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'sessions',
})
export class Session {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  refreshTokenHash!: string;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  /** TTL index: MongoDB removes the document automatically at this timestamp. */
  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
