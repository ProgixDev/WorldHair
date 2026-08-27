import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AccountService } from './account.service';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { EmailDto } from './dto/email.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { TokenDto } from './dto/token.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.register(dto, { userAgent });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @Body() dto: TokenDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.account.verifyEmail(dto.token, { userAgent });
  }

  // Tighter per-IP limit on top of the global default, for routes where
  // brute-forcing or mail-bombing via resend is the main risk.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: EmailDto): Promise<void> {
    await this.account.resendVerificationEmail(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.login(dto, { userAgent });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken, { userAgent });
  }

  // No @Public() and no @UseGuards() — the global JwtAuthGuard (APP_GUARD in
  // app.module.ts) already covers this route. Adding @UseGuards(JwtAuthGuard)
  // here would run the guard twice.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: EmailDto): Promise<void> {
    await this.account.forgotPassword(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.account.resetPassword(dto);
  }

  // No @Public() and no @UseGuards() — same reasoning as logout() above.
  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPassword(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: SetPasswordDto,
  ): Promise<void> {
    await this.auth.setPassword(current.id, dto);
  }
}
