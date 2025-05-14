import { Module } from '@nestjs/common';
import {TypeOrmModule} from "@nestjs/typeorm";
import {VideoEntity} from "../common/entities/VideoEntity";
import {SharedVideoController} from "./shared-video.controller";
import {SharedVideoService} from "./shared-video.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            VideoEntity,
        ]),
    ],
    controllers: [SharedVideoController],
    providers: [SharedVideoService],
})
export class SharedVideoModule {}
