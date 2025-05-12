import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {UserModule} from "../user/user.module";
import {TypeOrmModule} from "@nestjs/typeorm";
import {UserEntity} from "../common/entities/UserEntity";
import {ModeratorEntity} from "../common/entities/ModeratorEntity";
import {AuthModule} from "../auth/auth.module";
import {ModeratorModule} from "../moderator/moderator.module";
import {MulterModule} from "@nestjs/platform-express";
import {ChatEntity} from "../common/entities/ChatEntity";
import {EmailModule} from "../email/email.module";
import {VideoEntity} from "../common/entities/VideoEntity";
import {PresentationStartEntity} from "../common/entities/PresentationStartEntity";

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [
      AuthModule,
      UserModule,
      ModeratorModule,
      TypeOrmModule.forFeature([UserEntity, ModeratorEntity, ChatEntity, PresentationStartEntity, VideoEntity]),
      MulterModule.register({ dest: './uploads' }),
      EmailModule,
  ]
})
export class AdminModule {}
