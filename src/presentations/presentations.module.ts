import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';

import {PresentationsController} from './presentations.controller';
import {PresentationsService} from './presentations.service';
import {PresentationEntity} from '../common/entities/PresentationEntity';
import {ParticipantEntity} from '../common/entities/ParticipantEntity';
import {InvitationEntity} from '../common/entities/InvitationEntity';
import {AuthModule} from '../auth/auth.module';
import {ColorService} from './color.service';
import {PresentationMapper} from './presentations.mapper';
import {PresentationsGateway} from './presentations.gateway';
import {PresentationPartEntity} from '../common/entities/PresentationPartEntity';
import {PartsGateway} from "./parts.gateway";
import {MulterModule} from "@nestjs/platform-express";
import {PresentationStartEntity} from "../common/entities/PresentationStartEntity";
import {VideoEntity} from "../common/entities/VideoEntity";
import {TeleprompterGateway} from "./teleprompter.gateway";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            PresentationEntity,
            ParticipantEntity,
            InvitationEntity,
            PresentationPartEntity,
            PresentationStartEntity,
            VideoEntity,
        ]),
        AuthModule,
        MulterModule.register({dest: './uploads'})
    ],
    controllers: [PresentationsController],
    providers: [
        PresentationsService,
        ColorService,
        PresentationMapper,
        PresentationsGateway,
        PartsGateway,
        TeleprompterGateway,
    ],
})
export class PresentationsModule {
}
