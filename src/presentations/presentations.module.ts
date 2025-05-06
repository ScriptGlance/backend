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
import { PresentationGateway } from './presentations.gateway';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import {TextEditingGateway} from "./text-editing.gateway";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PresentationEntity,
      ParticipantEntity,
      InvitationEntity,
      PresentationPartEntity,
    ]),
    AuthModule,
  ],
  controllers: [PresentationsController],
  providers: [
    PresentationsService,
    ColorService,
    PresentationMapper,
    PresentationGateway,
    TextEditingGateway,
  ],
})
export class PresentationsModule {}
