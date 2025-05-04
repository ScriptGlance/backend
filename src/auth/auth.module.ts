import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { PassportModule } from '@nestjs/passport';
import { FacebookStrategy } from './facebook.strategy';
import { UserEntity } from '../common/entities/UserEntity';
import { ModeratorEntity } from '../common/entities/ModeratorEntity';
import { AdminEntity } from '../common/entities/AdminEntity';
import { PasswordResetTokenEntity } from '../common/entities/PasswordResetTokenEntity';
import { EmailVerificationCodeEntity } from '../common/entities/EmailVerificationCodeEntity';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ModeratorEntity,
      AdminEntity,
      PasswordResetTokenEntity,
      EmailVerificationCodeEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
    EmailModule,
    PassportModule.register({ defaultStrategy: 'google' })
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, FacebookStrategy],
})
export class AuthModule {}
