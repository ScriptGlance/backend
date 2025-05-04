import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/RegisterDto';
import { LoginDto } from './dto/LoginDto';
import { ForgotPasswordDto } from './dto/ForgotPasswordDto';
import { ResetPasswordDto } from './dto/ResetPasswordDto';
import { JwtService } from '@nestjs/jwt';
import {
  AUTH_TOKEN_EXPIRATION_DAYS,
  EMAIL_VERIFICATION_CODE_EXPIRATION_MINUTES,
  PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES,
  VERIFICATION_CODE_LENGTH,
} from '../common/Constants';
import { StandardResponse } from '../common/interface/StandardResponse';
import { TokenResponseDto } from './dto/TokenResponseDto';
import { ErrorCodeHttpException } from '../common/exception/ErrorCodeHttpException';
import { AuthErrorCode } from './enum/AuthErrorCode';
import { SendVerificationEmailDto } from './dto/SendVerificationEmailDto';
import { VerifyEmailDto } from './dto/VerifyEmailDto';
import { VerificationEmailResponseDto } from './dto/VerificationEmailResponseDto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '../common/enum/Role';
import { SocialAccountDto } from './dto/GoogleAccountDto';
import { UserEntity } from '../common/entities/UserEntity';
import { ModeratorEntity } from '../common/entities/ModeratorEntity';
import { AdminEntity } from '../common/entities/AdminEntity';
import { PasswordResetTokenEntity } from '../common/entities/PasswordResetTokenEntity';
import { EmailVerificationCodeEntity } from '../common/entities/EmailVerificationCodeEntity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(ModeratorEntity)
    private moderatorRepository: Repository<ModeratorEntity>,
    @InjectRepository(AdminEntity)
    private adminRepository: Repository<AdminEntity>,
    private jwtService: JwtService,
    @InjectRepository(PasswordResetTokenEntity)
    private passwordResetTokenRepository: Repository<PasswordResetTokenEntity>,
    @InjectRepository(EmailVerificationCodeEntity)
    private emailVerificationCodeRepository: Repository<EmailVerificationCodeEntity>,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(
    registerDto: RegisterDto,
  ): Promise<StandardResponse<TokenResponseDto>> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new ErrorCodeHttpException(
        'User with this email already exists',
        AuthErrorCode.EmailDuplicate,
        HttpStatus.BAD_REQUEST,
      );
    }
    const verificationCode = await this.emailVerificationCodeRepository.findOne(
      {
        where: { email: registerDto.email, isVerified: true },
      },
    );
    if (verificationCode === null) {
      throw new ErrorCodeHttpException(
        'Email not verified',
        AuthErrorCode.EmailNotVerified,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const hashedPassword = await this.hashPassword(registerDto.password);
    const user = await this.createUser(
      registerDto.firstName,
      registerDto.lastName,
      registerDto.email,
      hashedPassword,
    );
    await this.emailVerificationCodeRepository.remove([verificationCode]);
    return {
      data: new TokenResponseDto(this.generateAuthToken(user)),
      error: false,
    };
  }

  async login(loginDto: LoginDto): Promise<StandardResponse<TokenResponseDto>> {
    const account = await this.getAccountByEmail(loginDto.role, loginDto.email);
    if (account === null) {
      throw new ErrorCodeHttpException(
        'Invalid credentials',
        AuthErrorCode.InvalidCredentials,
        HttpStatus.UNAUTHORIZED,
      );
    }
    const passwordValid = await bcrypt.compare(
      loginDto.password,
      account.password,
    );
    if (!passwordValid) {
      throw new ErrorCodeHttpException(
        'Invalid credentials',
        AuthErrorCode.InvalidCredentials,
        HttpStatus.UNAUTHORIZED,
      );
    }

    console.log('Logging in user:', loginDto.email);
    return {
      data: new TokenResponseDto(this.generateAuthToken(account)),
      error: false,
    };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<StandardResponse<any>> {
    const account = await this.getAccountByEmail(
      forgotPasswordDto.role,
      forgotPasswordDto.email,
    );
    if (account === null) {
      return { error: false };
    }
    const existingToken = await this.passwordResetTokenRepository.findOne({
      where: {
        [forgotPasswordDto.role]: account,
        expiresAt: MoreThan(new Date()),
      },
    });
    if (existingToken) {
      throw new ErrorCodeHttpException(
        'A password reset token has already been issued and is still valid.',
        AuthErrorCode.PasswordResetTokenNotExpired,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const token = this.generateResetPasswordToken(
      forgotPasswordDto.role,
      account,
    );
    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES,
    );
    const passwordResetToken = this.passwordResetTokenRepository.create({
      [forgotPasswordDto.role]: account,
      token: token,
      expiresAt: expiresAt,
    });

    const resetLink = `${this.configService.get<string>('FRONTEND_URL')}/reset-password?token=${token}`;

    await this.emailService.sendEmail(
      forgotPasswordDto.email,
      'Відновлення паролю для ScriptGlance',
      `
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <h1 style="color: #333;">Запит на скидання паролю</h1>
          <p style="font-size: 16px; color: #555;">
            Ви отримали цей лист, оскільки хтось запросив скидання пароля для вашого облікового запису в ScriptGlance.
          </p>
          <p style="font-size: 16px; color: #555;">
            Якщо це були ви, натисніть кнопку нижче, щоб встановити новий пароль:
          </p>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; font-size: 16px;">
              Скинути пароль
            </a>
          </div>
          <p style="font-size: 14px; color: #999; margin-top: 20px;">
            Якщо ви не робили цього запиту, просто проігноруйте цей лист.
          </p>
          <p style="font-size: 14px; color: #999;">
            З найкращими побажаннями,<br/>Команда ScriptGlance
          </p>
        </div>
      </body>
    </html>
    `,
    );
    await this.passwordResetTokenRepository.save(passwordResetToken);
    return { error: false };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<StandardResponse<TokenResponseDto>> {
    await this.passwordResetTokenRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt <= :now', { now: new Date() })
      .execute();

    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: resetPasswordDto.token },
      relations: { [resetPasswordDto.role]: true },
    });
    if (resetToken === null || !resetToken[resetPasswordDto.role]) {
      throw new ErrorCodeHttpException(
        'Invalid reset token',
        AuthErrorCode.InvalidResetPasswordToken,
        HttpStatus.UNAUTHORIZED,
      );
    }
    resetToken[resetPasswordDto.role]!.password = await this.hashPassword(
      resetPasswordDto.newPassword,
    );

    await this.userRepository.save(resetToken[resetPasswordDto.role]!);
    await this.passwordResetTokenRepository.remove([resetToken]);
    console.log('Resetting password using token:', resetPasswordDto.token);
    return {
      data: new TokenResponseDto(
        this.generateAuthToken(resetToken[resetPasswordDto.role]!),
      ),
      error: false,
    };
  }

  async sendVerificationEmail(
    sendVerificationEmailDto: SendVerificationEmailDto,
  ): Promise<StandardResponse<VerificationEmailResponseDto>> {
    const account = await this.getAccountByEmail(
      sendVerificationEmailDto.role,
      sendVerificationEmailDto.email,
    );
    if (account !== null) {
      throw new ErrorCodeHttpException(
        'Account with this email already exists',
        AuthErrorCode.EmailDuplicate,
        HttpStatus.BAD_REQUEST,
      );
    }

    const verifiedCode = await this.emailVerificationCodeRepository.findOne({
      where: { email: sendVerificationEmailDto.email, isVerified: true },
    });
    if (verifiedCode !== null) {
      return {
        error: false,
        data: { isEmailAlreadyVerified: true },
      };
    }

    const existingCode = await this.emailVerificationCodeRepository.findOne({
      where: {
        email: sendVerificationEmailDto.email,
        isVerified: false,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (existingCode) {
      throw new ErrorCodeHttpException(
        'The valid verification code already sent',
        AuthErrorCode.EmailVerificationCodeNotExpired,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(
      expiresAt.getMinutes() + EMAIL_VERIFICATION_CODE_EXPIRATION_MINUTES,
    );
    const code = this.emailVerificationCodeRepository.create({
      email: sendVerificationEmailDto.email,
      expiresAt: expiresAt,
      verification_code: this.generateVerificationCode(),
      isVerified: false,
    });
    await this.emailService.sendEmail(
      sendVerificationEmailDto.email,
      'Код підтвердження Email від ScriptGlance',
      `
      <html>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h1 style="color: #333;">Ласкаво просимо до ScriptGlance!</h1>
            <p style="font-size: 16px; color: #555;">
              Ваш код підтвердження: <strong style="color: #000;">${code.verification_code}</strong>
            </p>
            <p style="font-size: 16px; color: #555;">
              Будь ласка, використайте цей код для активації вашого облікового запису.
            </p>
            <hr style="border: none; border-top: 1px solid #eee;" />
            <p style="font-size: 14px; color: #999;">
              З найкращими побажаннями,<br/>Команда ScriptGlance
            </p>
          </div>
        </body>
      </html>
  `,
    );
    await this.emailVerificationCodeRepository.save(code);
    return {
      error: false,
      data: { isEmailAlreadyVerified: false },
    };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
  ): Promise<StandardResponse<any>> {
    await this.emailVerificationCodeRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt <= :now', { now: new Date() })
      .andWhere('isVerified = :isVerified', { isVerified: false })
      .execute();

    const verificationCode = await this.emailVerificationCodeRepository.findOne(
      {
        where: {
          verification_code: verifyEmailDto.code,
          email: verifyEmailDto.email,
        },
      },
    );
    if (verificationCode === null) {
      throw new ErrorCodeHttpException(
        'Invalid verification code',
        AuthErrorCode.InvalidEmailVerificationCode,
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (verificationCode.isVerified) {
      throw new ErrorCodeHttpException(
        'Email already verified',
        AuthErrorCode.EmailAlreadyVerified,
        HttpStatus.BAD_REQUEST,
      );
    }

    verificationCode.isVerified = true;
    await this.emailVerificationCodeRepository.save(verificationCode);
    return {
      error: false,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  private getAccountId(
    account: UserEntity | ModeratorEntity | AdminEntity,
  ): number {
    let id: number;
    if (account instanceof UserEntity) {
      id = account.userId;
    } else if (account instanceof ModeratorEntity) {
      id = account.moderatorId;
    } else {
      id = account.adminId;
    }
    return id;
  }

  generateAuthToken(
    account: UserEntity | ModeratorEntity | AdminEntity,
  ): string {
    let role: Role;
    if (account instanceof UserEntity) {
      role = Role.User;
    } else if (account instanceof ModeratorEntity) {
      role = Role.Moderator;
    } else {
      role = Role.Admin;
    }
    return this.generateJwtToken(
      role,
      account,
      `${AUTH_TOKEN_EXPIRATION_DAYS}d`,
    );
  }

  private generateResetPasswordToken(
    role: Role,
    account: UserEntity | ModeratorEntity | AdminEntity,
  ): string {
    return this.generateJwtToken(
      role,
      account,
      `${PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES}m`,
    );
  }

  private generateVerificationCode(): string {
    const randomNum = Math.floor(
      Math.random() * 10 ** VERIFICATION_CODE_LENGTH,
    );
    return randomNum.toString().padStart(VERIFICATION_CODE_LENGTH, '0');
  }

  private generateJwtToken(
    role: Role,
    account: UserEntity | ModeratorEntity | AdminEntity,
    expiresIn: string,
  ): string {
    return this.jwtService.sign(
      { sub: this.getAccountId(account), email: account.email, role },
      { expiresIn },
    );
  }

  private async getAccountByEmail(
    role: Role,
    email: string,
  ): Promise<UserEntity | ModeratorEntity | AdminEntity | null> {
    let account: UserEntity | ModeratorEntity | AdminEntity | null;
    switch (role) {
      case Role.User:
        account = await this.userRepository.findOne({
          where: { email },
        });
        break;
      case Role.Moderator:
        account = await this.moderatorRepository.findOne({
          where: { email },
        });
        break;
      case Role.Admin:
        account = await this.adminRepository.findOne({
          where: { email },
        });
        break;
    }
    return account;
  }

  async validateSocialAccount(
    googleAccount: SocialAccountDto,
  ): Promise<UserEntity | ModeratorEntity | AdminEntity> {
    const account = await this.getAccountByEmail(
      googleAccount.role,
      googleAccount.email,
    );
    if (account) {
      return account;
    }
    if (googleAccount.role != Role.User) {
      throw new BadRequestException('Only users can be registered');
    }
    return this.createUser(
      googleAccount.firstName,
      googleAccount.lastName,
      googleAccount.email,
      '',
    );
  }

  private async createUser(
    firstName: string,
    lastName: string,
    email: string,
    hashedPassword: string,
  ) {
    const user = this.userRepository.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }
}
