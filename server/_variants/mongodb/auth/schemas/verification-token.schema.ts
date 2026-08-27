import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { baseSchemaOptionsHiding, withIdVirtual } from '../../common/schema/base-schema-options';
import { User } from '../../users/schemas/user.schema';

export enum VerificationTokenType {
  EmailVerify = 'email_verify',
  PasswordReset = 'password_reset',
}

@Schema({ ...baseSchemaOptionsHiding('tokenHash'), collection: 'verificationtokens' })
export class VerificationToken {
  // See RefreshToken.user — `MongooseSchema.Types.ObjectId`, not the
  // `Types.ObjectId` BSON constructor, which compiles to `Mixed`.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, enum: VerificationTokenType })
  type!: VerificationTokenType;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt!: Date | null;
}

export type VerificationTokenDocument = HydratedDocument<VerificationToken>;

export const VerificationTokenSchema = withIdVirtual(
  SchemaFactory.createForClass(VerificationToken),
);

VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Exactly one live row per (user, type): `issue()` upserts in place rather than
// invalidate-then-create, so this constraint is what makes that atomic.
VerificationTokenSchema.index({ user: 1, type: 1 }, { unique: true });
