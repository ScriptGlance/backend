import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import {ChatMapper} from "./chat.mapper";
import {TypeOrmModule} from "@nestjs/typeorm";
import {ChatEntity} from "../common/entities/ChatEntity";
import {ChatMessageEntity} from "../common/entities/ChatMessageEntity";
import {AuthModule} from "../auth/auth.module";
import {ChatGateway} from "./chat.gateway";
import {ChatCleanupService} from "./chat-cleanup.service";
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatMapper, ChatGateway, ChatCleanupService],
  imports: [
    TypeOrmModule.forFeature([ChatEntity, ChatMessageEntity]),
    AuthModule,
    NotificationsModule,
  ],
})
export class ChatModule {}
