export enum AuthErrorCode {
  InvalidCredentials = 0,
  EmailDuplicate,
  InvalidResetPasswordToken,
  InvalidEmailVerificationCode,
  EmailNotVerified,
  EmailAlreadyVerified,
  EmailVerificationCodeNotExpired,
  PasswordResetTokenNotExpired,
}
