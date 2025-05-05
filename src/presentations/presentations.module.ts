import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import { ParticipantEntity } from '../common/entities/ParticipantEntity';
import { InvitationEntity } from '../common/entities/InvitationEntity';
import { AuthModule } from '../auth/auth.module';
import { ColorService } from './color.service';
import { PresentationMapper } from './presentaion.mapper';
import {PresentationGateway} from "./presentations.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PresentationEntity,
      ParticipantEntity,
      InvitationEntity,
    ]),
    AuthModule,
  ],
  controllers: [PresentationsController],
  providers: [PresentationsService, ColorService, PresentationMapper, PresentationGateway],
})
export class PresentationsModule {}
