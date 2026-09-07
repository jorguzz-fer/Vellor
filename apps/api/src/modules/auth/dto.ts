import {
  AuthStatusSchema,
  ChangePasswordInputSchema,
  ForgotPasswordInputSchema,
  LoginInputSchema,
  MeSchema,
  MfaSetupResponseSchema,
  MfaVerifyInputSchema,
  OkSchema,
  RegisterInputSchema,
  ResetPasswordInputSchema,
  UpdateProfileInputSchema,
} from '@vellor/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(RegisterInputSchema) {}
export class LoginDto extends createZodDto(LoginInputSchema) {}
export class ForgotPasswordDto extends createZodDto(ForgotPasswordInputSchema) {}
export class ResetPasswordDto extends createZodDto(ResetPasswordInputSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordInputSchema) {}
export class MfaCodeDto extends createZodDto(MfaVerifyInputSchema) {}
export class UpdateProfileDto extends createZodDto(UpdateProfileInputSchema) {}
export class AuthStatusDto extends createZodDto(AuthStatusSchema) {}
export class MeDto extends createZodDto(MeSchema) {}
export class MfaSetupResponseDto extends createZodDto(MfaSetupResponseSchema) {}
export class OkDto extends createZodDto(OkSchema) {}
