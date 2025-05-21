import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserModule } from '../user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../common/entities/UserEntity';
import { ModeratorEntity } from '../common/entities/ModeratorEntity';
import { AuthModule } from '../auth/auth.module';
import { ModeratorModule } from '../moderator/moderator.module';
import { MulterModule } from '@nestjs/platform-express';
import { ChatEntity } from '../common/entities/ChatEntity';
import { EmailModule } from '../email/email.module';
import { VideoEntity } from '../common/entities/VideoEntity';
import { PresentationStartEntity } from '../common/entities/PresentationStartEntity';
import { PaymentsModule } from '../payments/payments.module';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { PresentationEntity } from '../common/entities/PresentationEntity';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [
    AuthModule,
    UserModule,
    ModeratorModule,
    TypeOrmModule.forFeature([
      UserEntity,
      ModeratorEntity,
      ChatEntity,
      PresentationStartEntity,
      VideoEntity,
      PresentationPartEntity,
      ParticipantEntity,
      PresentationEntity,
    ]),
    MulterModule.register({ dest: './uploads' }),
    EmailModule,
    PaymentsModule,
  ],
})
export class AdminModule {}
