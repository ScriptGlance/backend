import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChatService } from './chat.service';

@Injectable()
export class ChatCleanupService {
  constructor(private readonly chatService: ChatService) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'expireChatsJob',
  })
  async handleInactiveChats(): Promise<void> {
    const expiredChats = await this.chatService.findExpiredChats();

    if (!expiredChats) {
      return;
    }

    for (const chat of expiredChats) {
      await this.chatService.closeActiveChat(chat);
    }
  }
}
