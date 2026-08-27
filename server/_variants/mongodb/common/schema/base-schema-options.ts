import type { Schema as MongooseSchema, SchemaOptions } from 'mongoose';

/**
 * Applied to every schema in the app: `@Schema(baseSchemaOptions)`.
 * Guarantees createdAt/updatedAt, no `__v`, and `_id` surfaced as a string `id`
 * so clients never see Mongo internals.
 */
export const baseSchemaOptions = {
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret: Record<string, unknown>) => {
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      return ret;
    },
  },
  toObject: { virtuals: true },
  // `satisfies`, not `: SchemaOptions` — an annotation widens `id: false` to `boolean`,
  // which breaks Mongoose's conditional-type inference for `doc._id` downstream.
} satisfies SchemaOptions;

/**
 * Same conventions as `baseSchemaOptions`, plus fields that must never reach a
 * client (password hashes, token hashes) even when explicitly selected.
 */
export function baseSchemaOptionsHiding(...hidden: string[]) {
  return {
    ...baseSchemaOptions,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        if (ret._id !== undefined) {
          ret.id = String(ret._id);
          delete ret._id;
        }
        for (const field of hidden) {
          delete ret[field];
        }
        return ret;
      },
    },
    // Same reasoning as `baseSchemaOptions` above: `satisfies`, not a `: SchemaOptions`
    // return-type annotation — an annotation widens `id: false` to `boolean`, which
    // breaks Mongoose's conditional-type inference for `doc._id` downstream.
  } satisfies SchemaOptions;
}

/**
 * `baseSchemaOptions`/`baseSchemaOptionsHiding` both set `id: false`, which
 * disables Mongoose's automatic `id` virtual on the LIVE document (not just
 * toJSON output) — `doc.id` is `undefined` without this. Every schema using
 * either option must call this once: `withIdVirtual(SchemaFactory.createForClass(Foo))`.
 */
export function withIdVirtual<T extends MongooseSchema>(schema: T): T {
  schema.virtual('id').get(function (this: { _id: { toString(): string } }) {
    return this._id.toString();
  });
  return schema;
}
