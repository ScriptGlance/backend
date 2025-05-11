import {Injectable} from '@nestjs/common';
import {ChatMessageDto} from "./dto/ChatMessageDto";
import {StandardResponse} from "../common/interface/StandardResponse";
import {ChatEntity} from "../common/entities/ChatEntity";
import {IsNull, Repository} from "typeorm";
import {InjectRepository} from "@nestjs/typeorm";
import {ChatMapper} from "./chat.mapper";
import {ChatMessageEntity} from "../common/entities/ChatMessageEntity";
import {ChatGateway} from "./chat.gateway";
import {UserUnreadMessagesCountDto} from "./dto/UserUnreadMessagesCountDto";
import {ModeratorUnreadMessagesCountsDto} from "./dto/ModeratorUnreadMessagesCountsDto";
import {ChatDto} from "./dto/ChatDto";

@Injectable()
export class ChatService {
    constructor(
        @InjectRepository(ChatEntity)
        private readonly chatRepository: Repository<ChatEntity>,
        @InjectRepository(ChatMessageEntity)
        private readonly chatMessageRepository: Repository<ChatMessageEntity>,
        private readonly chatMapper: ChatMapper,
        private readonly chatGateway: ChatGateway,
    ) {}

    async getActiveUserChat(
        userId: number,
        limit = 20,
        offset = 0,
    ): Promise<StandardResponse<ChatMessageDto[]>> {
        const chat = await this.chatRepository.findOne({
            where: { user: { userId }, isActive: true },
        });

        if (!chat) {
            return { data: [], error: false };
        }

        await this.markMessagesAsRead(chat.chatId, true);

        const messages = await this.chatMessageRepository.find({
            where: { chat: { chatId: chat.chatId } },
            order: { sentDate: 'ASC' },
            skip: offset,
            take: limit,
        });

        return {
            data: this.chatMapper.toChatMessagesList(messages),
            error: false,
        };
    }

    async sendUserMessage(
        userId: number,
        text: string,
    ): Promise<StandardResponse<ChatMessageDto>> {
        let chat = await this.chatRepository.findOne({
            where: { user: { userId }, isActive: true },
            relations: ['user'],
        });

        if (!chat) {
            chat = this.chatRepository.create({
                user: { userId },
                isActive: true,
                creationDate: new Date(),
            });
            chat = await this.chatRepository.save(chat);
        }

        const message = this.chatMessageRepository.create({
            chat,
            text,
            sentDate: new Date(),
            isWrittenByModerator: false,
        });
        const saved = await this.chatMessageRepository.save(message);

        await this.chatGateway.emitUserMessage(saved)

        return {
            data: this.chatMapper.toChatMessageDto(saved),
            error: false,
        };
    }

    async getActiveUserChatUnreadCount(userId: number): Promise<StandardResponse<UserUnreadMessagesCountDto>> {
        const chat = await this.chatRepository.findOne({
            where: { user: { userId }, isActive: true },
            select: ['chatId'],
        });

        if (!chat) {
            return {
                data: { unread_count: 0 },
                error: false,
            };
        }

        const unreadCount = await this.chatMessageRepository.count({
            where: {
                chat: { chatId: chat.chatId },
                isWrittenByModerator: true,
                isRead: false,
            },
        });

        return {
            data: { unread_count: unreadCount },
            error: false,
        }
    }

    async markUserChatAsRead(userId: number): Promise<StandardResponse<void>> {
        const chat = await this.chatRepository.findOne({
            where: { user: { userId }, isActive: true },
            select: ['chatId'],
        });

        if (!chat) {
            return { error: false };
        }

        await this.markMessagesAsRead(chat.chatId, true);

        return { error: false };
    }

    private async markMessagesAsRead(chatId: number, isUser: boolean) {
        await this.chatMessageRepository.update(
            { chat: { chatId }, isWrittenByModerator: isUser },
            { isRead: true },
        );
    }

    async getModeratorChatsUnreadCounts(moderatorId: number): Promise<StandardResponse<ModeratorUnreadMessagesCountsDto>>  {
        const generalChatCount = await this.chatRepository.count({
            where: { assignedModerator: IsNull() },
        });

        const unreadModeratorMessagesCount = await this.chatMessageRepository.count({
            where: {
                chat: { assignedModerator: { moderatorId } },
                isWrittenByModerator: false,
                isRead: false,
            },
        });

        return {
            data: {
                general_chats_count: generalChatCount,
                assigned_chats_unread_messages_count: unreadModeratorMessagesCount,
            },
            error: false,
        }
    }

    async getModeratorChats(
        moderatorId: number,
        limit: number,
        offset: number,
        type: 'assigned' | 'general' | 'closed',
        search: string,
    ): Promise<StandardResponse<ChatDto[]>> {
        const builder = this.chatRepository
            .createQueryBuilder('chat')
            .leftJoinAndSelect('chat.user', 'user')
            .leftJoinAndSelect('chat.assignedModerator', 'moderator');

        if (type === 'assigned') {
            builder
                .where('moderator.moderatorId = :moderatorId', { moderatorId })
                .andWhere('chat.isActive = true');
        } else if (type === 'general') {
            builder
                .where('moderator.moderatorId IS NULL')
                .andWhere('chat.isActive = true');
        } else {
            builder.where('chat.isActive = false');
        }

        if (search) {
            builder.andWhere(
                `(
                  user.firstName ILIKE :search OR
                  user.lastName ILIKE :search OR
                  CONCAT(user.firstName, ' ', user.lastName) ILIKE :search
                )`,
                { search: `%${search}%` },
            );
        }


        const chats = await builder
            .orderBy('chat.creationDate', 'DESC')
            .skip(offset)
            .take(limit)
            .getMany();

        const dtos: ChatDto[] = await Promise.all(
            chats.map(async (chat) => {
                const last = await this.chatMessageRepository.findOne({
                    where: { chat: { chatId: chat.chatId } },
                    order: { sentDate: 'DESC' },
                });

                const unread = await this.chatMessageRepository.count({
                    where: {
                        chat: { chatId: chat.chatId },
                        isWrittenByModerator: false,
                        isRead: false,
                    },
                });

                return {
                    chat_id: chat.chatId,
                    user_full_name: `${chat.user.firstName} ${chat.user.lastName}`,
                    last_message: last?.text ?? '',
                    last_message_sent_date: last?.sentDate ?? new Date(0),
                    unread_messages_count: unread,
                };
            }),
        );

        return {
            data: dtos,
            error: false,
        };
    }

    async markModeratorChatAsRead(moderatorId: number, chatId: number) {
        return Promise.resolve(undefined);
    }
}
