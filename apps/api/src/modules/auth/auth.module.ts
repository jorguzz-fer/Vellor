import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminGuard, AuthenticatedGuard } from './guards';
import { MfaService } from './mfa.service';
import { PasswordService } from './password.service';
import { SessionMiddleware } from './session.middleware';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [
    SessionService,
    PasswordService,
    MfaService,
    AuthService,
    SessionMiddleware,
    AuthenticatedGuard,
    AdminGuard,
  ],
  exports: [SessionService, PasswordService, AuthService],
})
export class AuthModule {}
