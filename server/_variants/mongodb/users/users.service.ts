import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  emailVerified?: boolean;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async create(input: CreateUserInput): Promise<UserDocument> {
    try {
      return await this.userModel.create({
        email: input.email.toLowerCase().trim(),
        passwordHash: input.passwordHash,
        emailVerified: input.emailVerified ?? false,
      });
    } catch (error) {
      // Two concurrent registrations for the same email can both pass the
      // caller's findByEmail existence check, then both land here — the
      // unique email index is what actually stops the second write. Without
      // this, its loser would surface as an unhandled E11000 (a generic 500)
      // instead of the intended 409.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash')
      .exec();
  }

  findByIdWithPassword(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+passwordHash').exec();
  }

  async update(
    userId: string,
    changes: Partial<Pick<User, 'username' | 'displayName'>>,
  ): Promise<UserDocument | null> {
    try {
      return await this.userModel
        .findByIdAndUpdate(
          userId,
          { $set: changes },
          // `runValidators` is what makes the schema's `match`/`minlength` apply
          // on an update — Mongoose skips validators on updates by default.
          { returnDocument: 'after', runValidators: true },
        )
        .exec();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('That username is already taken');
      }
      throw error;
    }
  }

  setPasswordHash(userId: string, passwordHash: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: { passwordHash } }, { returnDocument: 'after' })
      .exec();
  }

  /**
   * Not exposed through `update()` (which only allows username/displayName —
   * a user-facing profile edit): this is an internal auth-state transition,
   * only ever called from `AccountService` after a verification token has
   * actually been consumed.
   */
  setEmailVerified(userId: string, emailVerified: boolean): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(userId, { $set: { emailVerified } }, { returnDocument: 'after' })
      .exec();
  }
}
