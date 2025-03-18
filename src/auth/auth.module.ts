import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/UserEntity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordResetTokenEntity } from './entities/PasswordResetTokenEntity';
import { EmailVerificationCodeEntity } from './entities/EmailVerificationCodeEntity';
import { EmailModule } from '../email/email.module';
import { ModeratorEntity } from './entities/ModeratorEntity';
import { AdminEntity } from './entities/AdminEntity';
import { PassportModule } from '@nestjs/passport';
import {GoogleStrategy} from "./google.strategy";

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
  providers: [AuthService, GoogleStrategy],
})
export class AuthModule {}
