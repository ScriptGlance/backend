import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BaseGateway } from '../common/base/base.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import {Role} from "../common/enum/Role";
import {Repository} from "typeorm";
import {ChatEntity} from "../common/entities/ChatEntity";
import {ModeratorChatMessageEventDto} from "./dto/ModeratorChatMessageEventDto";
import {InjectRepository} from "@nestjs/typeorm";
import {ChatMessageEntity} from "../common/entities/ChatMessageEntity";
type ChatSocket = Socket & { data: { user?: { id: number } } };

@WebSocketGateway({ cors: true, namespace: 'chats' })
export class ChatGateway extends BaseGateway {
    @WebSocketServer()
    server: Server;

    private GENERAL_CHATS_ROOM = "chat:moderators:general";

    constructor(
        jwtService: JwtService,
        configService: ConfigService,
        @InjectRepository(ChatEntity)
        private readonly chatRepository: Repository<ChatEntity>,
        @InjectRepository(ChatMessageEntity)
        private readonly chatMessageRepository: Repository<ChatMessageEntity>,
    ) {
        super(jwtService, configService, [Role.User, Role.Moderator]);
    }

    private getUserRoomName(userId: number): string {
        return `chat:user:${userId}`;
    }

    private getModeratorChatRoomName(moderatorId: number): string {
        return `chat:moderator:${moderatorId}`;
    }

    @SubscribeMessage('join_user_chat')
    async handleUserJoin(
        @ConnectedSocket() client: ChatSocket,
    ) {
        const userId = client.data.user?.id;
        if (!userId || client.data.user?.role !== Role.User) {
            return client.emit('error', 'Unauthorized');
        }
        client.join(this.getUserRoomName(userId));
    }

    @SubscribeMessage('join_moderator_chat')
    async handleModeratorJoin(
        @ConnectedSocket() client: ChatSocket,
    ) {
        const moderatorId = client.data.user?.id;
        if (!moderatorId || client.data.user?.role !== Role.Moderator) {
            return client.emit('error', 'Unauthorized');
        }
        client.join(this.GENERAL_CHATS_ROOM);
        client.join(this.getModeratorChatRoomName(moderatorId));
    }

   async emitUserMessage(newMessage: ChatMessageEntity) {

       const chat = await this.chatRepository.findOne({
           where: { user: { userId: newMessage.chat.user.userId }, isActive: true },
           relations: ['assignedModerator']
       });

       if (!chat) {
           return;
       }

       const messagesCount = await this.chatMessageRepository.count({
           where: { chat: { chatId: chat?.chatId } }
       });

       const message: ModeratorChatMessageEventDto = {
           is_new_chat: messagesCount == 1,
           chat_id: chat.chatId,
           user_full_name: newMessage.chat.user.firstName + " " + newMessage.chat.user.lastName,
           chat_message_id: newMessage.chatMessageId,
           is_written_by_moderator: false,
           text: newMessage.text,
           sent_date: newMessage.sentDate,
       }
       const room = chat.assignedModerator ?
           this.getModeratorChatRoomName(chat.assignedModerator.moderatorId) : this.GENERAL_CHATS_ROOM;
       this.server.to(room).emit('new_message', message);
   }
}
