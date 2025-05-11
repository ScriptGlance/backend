import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import {ChatMapper} from "./chat.mapper";
import {TypeOrmModule} from "@nestjs/typeorm";
import {ChatEntity} from "../common/entities/ChatEntity";
import {ChatMessageEntity} from "../common/entities/ChatMessageEntity";
import {AuthModule} from "../auth/auth.module";
import {ChatGateway} from "./chat.gateway";

@Module({
  controllers: [ChatController],
  providers: [ChatService, ChatMapper, ChatGateway],
  imports: [
    TypeOrmModule.forFeature([ChatEntity, ChatMessageEntity]),
    AuthModule,
  ],
})
export class ChatModule {}
