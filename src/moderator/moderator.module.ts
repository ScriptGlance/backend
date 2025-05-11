import { Module } from '@nestjs/common';
import { ModeratorController } from './moderator.controller';
import { ModeratorService } from './moderator.service';
import {TypeOrmModule} from "@nestjs/typeorm";
import {AuthModule} from "../auth/auth.module";
import {MulterModule} from "@nestjs/platform-express";
import {ModeratorEntity} from "../common/entities/ModeratorEntity";
import {ModeratorMapper} from "./moderator.mapper";

@Module({
  controllers: [ModeratorController],
  providers: [ModeratorService, ModeratorMapper],
  imports: [
    TypeOrmModule.forFeature([ModeratorEntity]),
    AuthModule,
    MulterModule.register({ dest: './uploads' }),
  ],
})
export class ModeratorModule {}
