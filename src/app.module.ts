import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './common/entities/UserEntity';
import { ModeratorEntity } from './common/entities/ModeratorEntity';
import { AdminEntity } from './common/entities/AdminEntity';
import { PasswordResetTokenEntity } from './common/entities/PasswordResetTokenEntity';
import { EmailVerificationCodeEntity } from './common/entities/EmailVerificationCodeEntity';
import { InvitationEntity } from './common/entities/InvitationEntity';
import { ParticipantEntity } from './common/entities/ParticipantEntity';
import { PresentationEntity } from './common/entities/PresentationEntity';
import { PresentationPartEntity } from './common/entities/PresentationPartEntity';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          UserEntity,
          ModeratorEntity,
          AdminEntity,
          PasswordResetTokenEntity,
          EmailVerificationCodeEntity,
          InvitationEntity,
          ParticipantEntity,
          PresentationEntity,
          PresentationPartEntity,
        ],
        synchronize: configService.get<boolean>('DEBUG'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
