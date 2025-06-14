import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { InvitationEntity } from '../common/entities/InvitationEntity';
import { AuthModule } from '../auth/auth.module';
import { ColorService } from './color.service';
import { PresentationMapper } from './presentations.mapper';
import { PresentationsGateway } from './presentations.gateway';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { PartsGateway } from './parts.gateway';
import { MulterModule } from '@nestjs/platform-express';
import { PresentationStartEntity } from '../common/entities/PresentationStartEntity';
import { VideoEntity } from '../common/entities/VideoEntity';
import { TeleprompterGateway } from './teleprompter.gateway';
import { UserEntity } from '../common/entities/UserEntity';
import { UserWithPremiumEntity } from '../common/entities/UserWithPremiumEntity';
import { UserModule } from '../user/user.module';
import { UserInvitationEntity } from '../common/entities/UserInvitationEntity';
import { PresentationPartContentService } from './presentation-part-content.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PresentationEntity,
      ParticipantEntity,
      InvitationEntity,
      PresentationPartEntity,
      PresentationStartEntity,
      VideoEntity,
      UserEntity,
      UserWithPremiumEntity,
      UserInvitationEntity,
    ]),
    AuthModule,
    UserModule,
    MulterModule.register({ dest: './uploads' }),
    NotificationsModule,
  ],
  controllers: [PresentationsController],
  providers: [
    PresentationsService,
    ColorService,
    PresentationMapper,
    PresentationsGateway,
    PartsGateway,
    TeleprompterGateway,
    PresentationPartContentService,
  ],
})
export class PresentationsModule {}
