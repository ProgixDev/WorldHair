import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { AccountService } from './account.service';
import { AuthResponseDto, toAuthResponse } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { PasswordService } from './password.service';
import { TokenContext } from './token.types';
import { TokensService } from './tokens.service';

/**
 * Session issuance: register, login, refresh, logout, and changing an
 * already-authenticated session's password. Account state changes OUTSIDE an
 * active session (email verification, forgotten-password reset) live in
 * `AccountService` instead — see its doc comment for why the split.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokensService,
    private readonly account: AccountService,
  ) {}

  private async buildAuthResponse(
    user: UserDocument,
    context: TokenContext,
  ): Promise<AuthResponseDto> {
    const pair = await this.tokens.issuePair(user.id, context);

    return toAuthResponse(user, pair);
  }

  async register(dto: RegisterDto, context: TokenContext): Promise<AuthResponseDto> {
    const existing = await this.users.findByEmail(dto.email);

    if (existing) {
      // Deliberately DOES reveal that the email exists — registering with a
      // known address implies the caller believes it might be theirs, unlike
      // a bare resend/reset request (see AccountService), which does not.
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.users.create({
      email: dto.email,
      passwordHash: await this.passwords.hash(dto.password),
    });

    await this.account.sendVerificationEmail(user);

    return this.buildAuthResponse(user, context);
  }

  async login(dto: LoginDto, context: TokenContext): Promise<AuthResponseDto> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    const matches = user ? await this.passwords.compare(dto.password, user.passwordHash) : false;

    // One message for both failure modes — no account enumeration.
    if (!user || !matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user, context);
  }

  async refresh(refreshToken: string, context: TokenContext): Promise<AuthResponseDto> {
    const pair = await this.tokens.rotate(refreshToken, context);
    const payload = this.tokens.decodeAccessToken(pair.accessToken);
    const user = await this.users.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    return toAuthResponse(user, pair);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async setPassword(userId: string, dto: SetPasswordDto): Promise<void> {
    const user = await this.users.findByIdWithPassword(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    const matches = await this.passwords.compare(dto.currentPassword, user.passwordHash);

    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    await this.users.setPasswordHash(user.id, await this.passwords.hash(dto.password));
    // Unlike AccountService.resetPassword, this does NOT revoke other sessions —
    // the caller is already authenticated with a valid access token, so there's
    // no compromise signal here, just an intentional credential change from a
    // known session.
  }
}
