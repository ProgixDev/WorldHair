import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptionsHiding, withIdVirtual } from '../../common/schema/base-schema-options';
import { User } from '../../users/schemas/user.schema';

@Schema({ ...baseSchemaOptionsHiding('tokenHash'), collection: 'refreshtokens' })
export class RefreshToken {
  // `MongooseSchema.Types.ObjectId`, NOT the `Types.ObjectId` value: the
  // latter is the BSON constructor, which Mongoose's schema compiler does not
  // recognise as a SchemaType and silently compiles to `Mixed` — meaning no
  // casting at all, so whatever a caller passes is stored and matched verbatim.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true })
  user!: Types.ObjectId;

  /** sha256 of the issued JWT — the raw token is never stored. */
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  /** Shared by every token descended from one login; revoked as a unit on reuse. */
  @Prop({ required: true, index: true })
  family!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;

export const RefreshTokenSchema = withIdVirtual(SchemaFactory.createForClass(RefreshToken));

// Mongo drops rows once expiresAt passes — no cleanup job needed.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
