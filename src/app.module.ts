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
import { PresentationsModule } from './presentations/presentations.module';
import { UserWithPremiumEntity } from './common/entities/UserWithPremiumEntity';
import { SubscriptionEntity } from './common/entities/SubscriptionEntity';
import { dataSourceOptions } from '../data-source';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    EmailModule,
    PresentationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
