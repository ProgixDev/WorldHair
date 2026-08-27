import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { PasswordService } from './password.service';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';
import { VerificationToken, VerificationTokenSchema } from './schemas/verification-token.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokensService } from './tokens.service';
import { VerificationService } from './verification.service';

@Module({
  imports: [
    UsersModule,
    MailModule,
    PassportModule,
    // Secrets are passed per sign/verify call, so no global secret here.
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: VerificationToken.name, schema: VerificationTokenSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountService,
    PasswordService,
    TokensService,
    VerificationService,
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
  ],
  exports: [TokensService, JwtAuthGuard, OptionalJwtAuthGuard, PasswordService],
})
export class AuthModule {}
