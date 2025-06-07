import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ChatMessageDto } from './dto/ChatMessageDto';
import { StandardResponse } from '../common/interface/StandardResponse';
import { ChatEntity } from '../common/entities/ChatEntity';
import { IsNull, Repository, In, Not } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatMapper } from './chat.mapper';
import { ChatMessageEntity } from '../common/entities/ChatMessageEntity';
import { ChatGateway } from './chat.gateway';
import { UserUnreadMessagesCountDto } from './dto/UserUnreadMessagesCountDto';
import { ModeratorUnreadMessagesCountsDto } from './dto/ModeratorUnreadMessagesCountsDto';
import { ChatDto } from './dto/ChatDto';
import { ModeratorEntity } from '../common/entities/ModeratorEntity';
import {CHAT_EXPIRATION_TIME_SECONDS} from "../common/Constants";

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
      order: { sentDate: 'DESC' },
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

    const lastMessage = (await this.chatMessageRepository.findOne({
      where: { chatMessageId: saved.chatMessageId },
      relations: ['chat', 'chat.user'],
    }))!;
    await this.chatGateway.emitUserMessage(lastMessage);

    return {
      data: this.chatMapper.toChatMessageDto(lastMessage),
      error: false,
    };
  }

  async sendModeratorMessage(
    moderatorId: number,
    chatId: number,
    text: string,
  ): Promise<StandardResponse<ChatMessageDto>> {
    const chat = await this.chatRepository.findOne({
      where: { chatId, assignedModerator: { moderatorId }, isActive: true },
      relations: ['assignedModerator', 'user'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const message = this.chatMessageRepository.create({
      chat,
      text,
      sentDate: new Date(),
      isWrittenByModerator: true,
    });
    const saved = await this.chatMessageRepository.save(message);

    this.chatGateway.emitModeratorMessage(saved);

    return {
      data: this.chatMapper.toChatMessageDto(saved),
      error: false,
    };
  }

  async getActiveUserChatUnreadCount(
    userId: number,
  ): Promise<StandardResponse<UserUnreadMessagesCountDto>> {
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
    };
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

  async getModeratorChatsUnreadCounts(
    moderatorId: number,
  ): Promise<StandardResponse<ModeratorUnreadMessagesCountsDto>> {
    const generalChatCount = await this.chatRepository.count({
      where: { assignedModerator: IsNull(), isActive: true },
    });

    const unreadModeratorMessagesCount = await this.chatMessageRepository.count(
      {
        where: {
          chat: { assignedModerator: { moderatorId } },
          isWrittenByModerator: false,
          isRead: false,
        },
      },
    );

    return {
      data: {
        general_chats_count: generalChatCount,
        assigned_chats_unread_messages_count: unreadModeratorMessagesCount,
      },
      error: false,
    };
  }

  async getModeratorChats(
    moderatorId: number,
    limit: number,
    offset: number,
    type: 'assigned' | 'general' | 'closed',
    search: string,
  ): Promise<StandardResponse<ChatDto[]>> {
    const subQuery = this.chatRepository
      .createQueryBuilder('c2')
      .select('c2.userUserId', 'user_user_id')
      .addSelect('MAX(c2.creationDate)', 'max_date')
      .groupBy('c2.userUserId')
      .getQuery();

    const qb = this.chatRepository
      .createQueryBuilder('chat')
      .innerJoin(
        `(${subQuery})`,
        'latest',
        'latest.user_user_id = chat.userUserId AND latest.max_date = chat.creationDate',
      )
      .leftJoinAndSelect('chat.user', 'user')
      .leftJoinAndSelect('chat.assignedModerator', 'moderator');

    if (type === 'assigned') {
      qb.andWhere('moderator.moderatorId = :moderatorId', {
        moderatorId,
      }).andWhere('chat.isActive = true');
    } else if (type === 'general') {
      qb.andWhere('moderator.moderatorId IS NULL').andWhere(
        'chat.isActive = true',
      );
    } else {
      qb.andWhere('chat.isActive = false');
    }

    if (search) {
      qb.andWhere(
        `(
         user.firstName ILIKE :search OR
         user.lastName  ILIKE :search OR
         (user.firstName || ' ' || user.lastName) ILIKE :search
       )`,
        { search: `%${search}%` },
      );
    }

    const chats = await qb
      .orderBy('chat.creationDate', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const dtos: ChatDto[] = await Promise.all(
      chats.map(async (chat) => {
        return await this.mapToChatDto(chat);
      }),
    );

    return { data: dtos, error: false };
  }

  private async mapToChatDto(chat: ChatEntity) {
    const lastMessage = await this.chatMessageRepository.findOne({
      where: {chat: {chatId: chat.chatId}},
      order: {sentDate: 'DESC'},
    });
    const unreadCount = await this.chatMessageRepository.count({
      where: {
        chat: {chatId: chat.chatId, isActive: true},
        isWrittenByModerator: false,
        isRead: false,
      },
    });
    return this.chatMapper.toChatDto(chat, lastMessage, unreadCount)
  }

  async markModeratorChatAsRead(moderatorId: number, chatId: number) {
    const chat = await this.chatRepository.findOne({
      where: { chatId, assignedModerator: { moderatorId }, isActive: true },
      select: ['chatId'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    await this.markMessagesAsRead(chat.chatId, false);

    return { error: false };
  }

  async getModeratorChatMessages(
    moderatorId: number,
    chatId: number,
    limit = 20,
    offset = 0,
  ): Promise<StandardResponse<ChatMessageDto[]>> {
    const chat = await this.chatRepository.findOne({
      where: [
        { chatId, assignedModerator: { moderatorId } },
        { chatId, assignedModerator: IsNull() },
        { chatId, isActive: false },
      ],
      relations: ['user'],
    });

    if (!chat) {
      throw new NotFoundException('Chat not found');
    }

    const lastUserChat = await this.chatRepository
      .createQueryBuilder('chat')
      .where('chat.userUserId = :userId', { userId: chat.user.userId })
      .select(['chat.chatId'])
      .orderBy('chat.creationDate', 'DESC')
      .limit(1)
      .getOne();

    if (lastUserChat && lastUserChat.chatId !== chat.chatId) {
      throw new ForbiddenException('You can access only latest user chat');
    }

    if (chat.assignedModerator) {
      await this.markMessagesAsRead(chatId, false);
    }

    const userId = chat.user.userId;

    const messages = await this.chatMessageRepository
      .createQueryBuilder('message')
      .innerJoin('message.chat', 'chat')
      .innerJoin('chat.user', 'user')
      .where('user.userId = :userId', { userId })
      .orderBy('message.sentDate', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    return {
      data: this.chatMapper.toChatMessagesList(messages),
      error: false,
    };
  }

  async closeChat(
    moderatorId: number,
    chatId: number,
  ): Promise<StandardResponse<void>> {
    const chat = await this.chatRepository.findOne({
      where: { chatId, assignedModerator: { moderatorId }, isActive: true },
      relations: ['user'],
    });

    if (!chat) {
      throw new NotFoundException('Active chat not found');
    }

    await this.closeActiveChat(chat);

    return { error: false };
  }

  async closeActiveChat(chat: ChatEntity) {
    chat.isActive = false;
    await this.chatRepository.save(chat);

    this.chatGateway.emitUserChatClosedMessage(chat.user.userId, await this.mapToChatDto(chat));
  }

  async findExpiredChats(): Promise<ChatEntity[]> {
    const threshold = new Date(
        Date.now() - CHAT_EXPIRATION_TIME_SECONDS * 1000,
    );

    return this.chatRepository
        .createQueryBuilder('chat')
        .innerJoinAndSelect('chat.user', 'u')
        .where('chat.isActive = :active', { active: true })
        .andWhere(builder => {
          const subQuery = builder
              .subQuery()
              .select('1')
              .from(ChatMessageEntity, 'msg')
              .where('msg.chatChatId = chat.chatId')
              .andWhere('msg.sentDate > :threshold')
              .getQuery();
          return `NOT EXISTS ${subQuery}`;
        })
        .setParameter('threshold', threshold)
        .getMany();
  }

  async changeChatAssignee(
    moderatorId: number,
    newAssigneeModeratorId: number | null,
    chatId: number,
  ): Promise<StandardResponse<void>> {
    const chat = await this.chatRepository.findOne({
      where: {
        chatId,
        assignedModerator: newAssigneeModeratorId ? IsNull() : { moderatorId },
        isActive: true,
      },
    });

    if (!chat) {
      throw new NotFoundException('Active chat not found');
    }

    chat.assignedModerator = {
      moderatorId: newAssigneeModeratorId,
    } as ModeratorEntity;
    await this.chatRepository.save(chat);

    this.chatGateway.emitGeneralChatAssigmentChangeMessage(
      chatId,
      newAssigneeModeratorId,
    );

    return { error: false };
  }
}
