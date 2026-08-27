import { BadRequestException, Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AuthResponseDto, toAuthResponse } from './dto/auth-response.dto';
import { PasswordService } from './password.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenContext } from './token.types';
import { TokensService } from './tokens.service';
import { VerificationTokenType } from './schemas/verification-token.schema';
import { VerificationService } from './verification.service';

/**
 * Account state changes outside an active session: email verification and a
 * forgotten-password reset. Session issuance (register/login/refresh/logout)
 * lives in `AuthService` instead, which depends on this service for
 * `sendVerificationEmail` during registration — keeping the dependency
 * one-directional avoids a circular provider reference between the two.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly verification: VerificationService,
    private readonly mail: MailService,
  ) {}

  async sendVerificationEmail(user: UserDocument): Promise<void> {
    const token = await this.verification.issue(user.id, VerificationTokenType.EmailVerify);

    await this.mail.sendVerificationEmail(user.email, token);
  }

  async verifyEmail(token: string, context: TokenContext): Promise<AuthResponseDto> {
    const userId = await this.verification.consume(token, VerificationTokenType.EmailVerify);

    if (!userId) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    const user = await this.users.setEmailVerified(userId, true);

    if (!user) {
      throw new BadRequestException('Verification link is invalid or has expired');
    }

    const pair = await this.tokens.issuePair(user.id, context);
    return toAuthResponse(user, pair);
  }

  /** Always resolves — never reveals whether an address is registered. */
  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);

    if (user && !user.emailVerified) {
      await this.sendVerificationEmail(user);
    }
  }

  /** Always resolves — never reveals whether an address is registered. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);

    if (!user) {
      return;
    }

    const token = await this.verification.issue(user.id, VerificationTokenType.PasswordReset);

    await this.mail.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.verification.consume(dto.token, VerificationTokenType.PasswordReset);

    if (!userId) {
      throw new BadRequestException('Reset link is invalid or has expired');
    }

    await this.users.setPasswordHash(userId, await this.passwords.hash(dto.password));
    // A reset implies "I may have been compromised" — drop every session.
    await this.tokens.revokeAllForUser(userId);
  }
}
