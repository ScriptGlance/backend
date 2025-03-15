import { HttpStatus, Injectable } from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {UserEntity} from './entities/UserEntity';
import * as bcrypt from 'bcrypt';
import {RegisterDto} from './dto/RegisterDto';
import {LoginDto} from './dto/LoginDto';
import {ForgotPasswordDto} from './dto/ForgotPasswordDto';
import {ResetPasswordDto} from './dto/ResetPasswordDto';
import {JwtService} from '@nestjs/jwt';
import {PasswordResetTokenEntity} from "./entities/PasswordResetTokenEntity";
import {
  AUTH_TOKEN_EXPIRATION_DAYS, EMAIL_VERIFICATION_CODE_EXPIRATION_MINUTES,
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES, VERIFICATION_CODE_LENGTH
} from "../common/Constants";
import {StandardResponse} from "../common/interface/StandardResponse";
import {TokenResponseDto} from "./dto/TokenResponseDto";
import {ErrorCodeHttpException} from "../common/exception/ErrorCodeHttpException";
import {AuthErrorCode} from "./enum/AuthErrorCode";
import {SendVerificationEmailDto} from "./dto/SendVerificationEmailDto";
import {EmailVerificationCodeEntity} from "./entities/EmailVerificationCodeEntity";
import {VerifyEmailDto} from "./dto/VerifyEmailDto";
import {VerificationEmailResponseDto} from "./dto/VerificationEmailResponseDto";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    private jwtService: JwtService,
    @InjectRepository(PasswordResetTokenEntity)
    private passwordResetTokenRepository: Repository<PasswordResetTokenEntity>,
    @InjectRepository(EmailVerificationCodeEntity)
    private emailVerificationCodeRepository: Repository<EmailVerificationCodeEntity>
  ) {}

  async register(registerDto: RegisterDto): Promise<StandardResponse<TokenResponseDto>> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new ErrorCodeHttpException(
          'User with this email already exists',
          AuthErrorCode.EmailDuplicate,
          HttpStatus.BAD_REQUEST
      );
    }
    const verificationCode = await this.emailVerificationCodeRepository.findOne({
      where: { email: registerDto.email, isVerified: true }
    });
    if (verificationCode === null) {
      throw new ErrorCodeHttpException(
          'Email not verified',
          AuthErrorCode.EmailNotVerified,
          HttpStatus.UNAUTHORIZED
      );
    }
    if(!this.checkPassword(registerDto.password)) {
      throw new ErrorCodeHttpException(
          'Invalid password length',
          AuthErrorCode.InvalidPasswordLength,
          HttpStatus.BAD_REQUEST
      );
    }
    const hashedPassword = await this.hashPassword(registerDto.password)
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });
    await this.userRepository.save(user);
    await this.emailVerificationCodeRepository.remove([verificationCode])
    return {
      data: new TokenResponseDto(this.generateAuthToken(user)),
      error: false,
    };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<StandardResponse<TokenResponseDto>> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });
    if (!user) {
      throw new ErrorCodeHttpException(
          'Invalid credentials',
          AuthErrorCode.InvalidCredentials,
          HttpStatus.UNAUTHORIZED
      )
    }
    const passwordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!passwordValid) {
      throw new ErrorCodeHttpException(
          'Invalid credentials',
          AuthErrorCode.InvalidCredentials,
          HttpStatus.UNAUTHORIZED
      )
    }

    console.log('Logging in user:', loginDto.email);
    return {
      data: new TokenResponseDto(this.generateAuthToken(user)),
      error: false,
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<StandardResponse<any>> {
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });
    if (!user) {
      return {error: false };
    }
    const token = this.jwtService.sign(
      { sub: user.userId, email: user.email },
      { expiresIn: `${PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES}m` }
    );
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES);
    const passwordResetToken = this.passwordResetTokenRepository.create({
      user: user,
      token: token,
      expiresAt: expiresAt
    });
    await this.passwordResetTokenRepository.save(passwordResetToken);

    console.log('Password reset requested for:', forgotPasswordDto.email);
    return { error: false };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<StandardResponse<TokenResponseDto>> {
    await this.passwordResetTokenRepository
        .createQueryBuilder()
        .delete()
        .where("expiresAt <= :now", { now: new Date() })
        .execute();

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: resetPasswordDto.token }, relations: { user: true },
    });
    if (resetToken === null) {
      throw new ErrorCodeHttpException(
          'Invalid reset token',
          AuthErrorCode.InvalidResetPasswordToken,
          HttpStatus.UNAUTHORIZED
      );
    }
    if(!this.checkPassword(resetPasswordDto.newPassword)) {
      throw new ErrorCodeHttpException(
          'Invalid password length',
          AuthErrorCode.InvalidPasswordLength,
          HttpStatus.BAD_REQUEST
      );
    }
    resetToken.user!.password = await this.hashPassword(resetPasswordDto.newPassword);

    await this.userRepository.save(resetToken.user!);
    await this.passwordResetTokenRepository.remove([resetToken]);
    console.log('Resetting password using token:', resetPasswordDto.token);
    return {
      data: new TokenResponseDto(this.generateAuthToken(resetToken.user!)),
      error: false,
    };
  }

  async sendVerificationEmail(sendVerificationEmailDto: SendVerificationEmailDto): Promise<StandardResponse<VerificationEmailResponseDto>> {
    const existingUser = await this.userRepository.findOne({
      where: { email: sendVerificationEmailDto.email },
    });
    if (existingUser) {
      throw new ErrorCodeHttpException(
          'User with this email already exists',
          AuthErrorCode.EmailDuplicate,
          HttpStatus.BAD_REQUEST
      );
    }

    const verifiedCode = await this.emailVerificationCodeRepository.findOne({
      where: {email: sendVerificationEmailDto.email, isVerified: true}
    })
    if(verifiedCode !== null) {
      return {
        error: false,
        data: { isEmailAlreadyVerified: true }
      }
    }
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + EMAIL_VERIFICATION_CODE_EXPIRATION_MINUTES);
    const code = this.emailVerificationCodeRepository.create({
      email: sendVerificationEmailDto.email,
      expiresAt: expiresAt,
      verification_code: this.generateVerificationCode(),
      isVerified: false
    });
    await this.emailVerificationCodeRepository.save(code);
    return {
      error: false,
      data: { isEmailAlreadyVerified: false }
    }
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<StandardResponse<any>> {
    await this.emailVerificationCodeRepository
        .createQueryBuilder()
        .delete()
        .where('expiresAt <= :now', { now: new Date() })
        .andWhere('isVerified = :isVerified', { isVerified: false })
        .execute();

    const verificationCode = await this.emailVerificationCodeRepository.findOne({
      where: { verification_code: verifyEmailDto.code, email: verifyEmailDto.email }
    });
    if (verificationCode === null) {
      throw new ErrorCodeHttpException(
          'Invalid verification code',
          AuthErrorCode.InvalidEmailVerificationCode,
          HttpStatus.UNAUTHORIZED
      );
    }
    if (verificationCode.isVerified) {
      throw new ErrorCodeHttpException(
          'Email already verified',
          AuthErrorCode.EmailAlreadyVerified,
          HttpStatus.BAD_REQUEST
      );
    }

    verificationCode.isVerified = true;
    await this.emailVerificationCodeRepository.save(verificationCode)
    return {
      error: false,
    };
  }

  private checkPassword(password: string): boolean {
    return password.length >= MIN_PASSWORD_LENGTH;
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10)
  }

  private generateAuthToken(user: UserEntity): string {
    return this.jwtService.sign(
        { sub: user.userId, email: user.email },
        { expiresIn: `${AUTH_TOKEN_EXPIRATION_DAYS}d` }
    );
  }

  private generateVerificationCode(): string {
    const randomNum = Math.floor(Math.random() * 10 ** VERIFICATION_CODE_LENGTH);
    return randomNum.toString().padStart(VERIFICATION_CODE_LENGTH, '0');
  }
}
