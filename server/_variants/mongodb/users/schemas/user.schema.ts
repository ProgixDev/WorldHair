import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { baseSchemaOptionsHiding, withIdVirtual } from '../../common/schema/base-schema-options';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from '../username.util';

@Schema({ ...baseSchemaOptionsHiding('passwordHash'), collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  /** Never returned to a client — see `baseSchemaOptionsHiding('passwordHash')` above. */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ default: false })
  emailVerified!: boolean;

  /**
   * Optional profile fields — empty until the user sets them via
   * `PATCH /users/me`. Registration deliberately does not ask for either:
   * it only creates the auth identity (email + password).
   */
  @Prop({ type: String, default: '', trim: true, maxlength: 50 })
  displayName!: string;

  /**
   * Unique handle, stored lowercase — see `username.util.ts` for the pattern.
   * Absent (not just empty-string) until the user chooses one, which is what
   * lets the partial unique index below allow any number of accounts with no
   * handle yet.
   */
  @Prop({
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    minlength: USERNAME_MIN_LENGTH,
    maxlength: USERNAME_MAX_LENGTH,
    match: USERNAME_PATTERN,
  })
  username?: string;

  // Not @Prop-decorated: `timestamps: true` in baseSchemaOptionsHiding already
  // adds these as real schema paths. These declarations only give the `User`
  // class (and therefore `HydratedDocument<User>`) a typed field.
  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema = withIdVirtual(SchemaFactory.createForClass(User));

// A username is only unique among accounts that HAVE one — `partialFilterExpression`
// with `$type: 'string'`, not `sparse: true`: a sparse index only excludes a field
// that is truly absent, which is exactly the case here (no empty-string placeholder).
UserSchema.index(
  { username: 1 },
  { unique: true, partialFilterExpression: { username: { $type: 'string' } } },
);
