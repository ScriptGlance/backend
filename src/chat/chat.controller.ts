import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { GetUser } from '../common/decorators/get-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { SendChatMessageDto } from './dto/SendChatMessageDto';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly service: ChatService) {}

  @Get('user/active')
  @Roles('user')
  @ApiTags('User chat')
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    example: 0,
  })
  async getActiveUserChat(
    @GetUser('id') userId: number,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
  ) {
    return this.service.getActiveUserChat(userId, limit, offset);
  }

  @Post('user/active')
  @Roles('user')
  @ApiTags('User chat')
  @ApiBody({ type: SendChatMessageDto })
  async sendMessage(
    @GetUser('id') userId: number,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.service.sendUserMessage(userId, dto.text);
  }

  @Get('user/active/unread-count')
  @Roles('user')
  @ApiTags('User chat')
  async getActiveUserChatUnreadCount(@GetUser('id') userId: number) {
    return await this.service.getActiveUserChatUnreadCount(userId);
  }

  @Put('user/active/read')
  @Roles('user')
  @ApiTags('User chat')
  async markChatAsRead(@GetUser('id') userId: number) {
    return await this.service.markUserChatAsRead(userId);
  }

  @Get('moderator/unread-counts')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  async getModeratorChatsUnreadCounts(@GetUser('id') moderatorId: number) {
    return await this.service.getModeratorChatsUnreadCounts(moderatorId);
  }

  @Get('moderator/chats')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    example: 0,
  })
  @ApiQuery({
    name: 'type',
    required: true,
    type: String,
    example: 'assigned',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    example: '',
  })
  async getModeratorChats(
    @GetUser('id') moderatorId: number,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
    @Query('type') type: 'assigned' | 'general' | 'closed',
    @Query('search') search: string = '',
  ) {
    return await this.service.getModeratorChats(
      moderatorId,
      limit,
      offset,
      type,
      search,
    );
  }

  @Put('moderator/:id/read')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  async markModeratorChatAsRead(
    @GetUser('id') moderatorId: number,
    @Param('id', ParseIntPipe) chatId: number,
  ) {
    return await this.service.markModeratorChatAsRead(moderatorId, chatId);
  }

  @Get('moderator/:chatId/messages')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    example: 0,
  })
  async getModeratorChatMessages(
    @GetUser('id') moderatorId: number,
    @Param('chatId', ParseIntPipe) chatId: number,
    @Query('limit', ParseIntPipe) limit = 20,
    @Query('offset', ParseIntPipe) offset = 0,
  ) {
    return this.service.getModeratorChatMessages(
      moderatorId,
      chatId,
      limit,
      offset,
    );
  }

  @Post('moderator/:chatId/messages')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  @ApiBody({ type: SendChatMessageDto })
  async sendModeratorMessage(
    @GetUser('id') moderatorId: number,
    @Param('chatId', ParseIntPipe) chatId: number,
    @Body() dto: SendChatMessageDto,
  ) {
    return this.service.sendModeratorMessage(moderatorId, chatId, dto.text);
  }

  @Post('moderator/:chatId/close')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  @ApiParam({
    name: 'chatId',
    required: true,
    type: Number,
  })
  async closeChat(
    @GetUser('id') moderatorId: number,
    @Param('chatId', ParseIntPipe) chatId: number,
  ) {
    return this.service.closeChat(moderatorId, chatId);
  }

  @Put('moderator/:chatId/assign')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  @ApiParam({
    name: 'chatId',
    required: true,
    type: Number,
  })
  async assignChat(
    @GetUser('id') moderatorId: number,
    @Param('chatId', ParseIntPipe) chatId: number,
  ) {
    return this.service.changeChatAssignee(moderatorId, moderatorId, chatId);
  }

  @Put('moderator/:chatId/unassign')
  @Roles('moderator')
  @ApiTags('Moderator chat')
  @ApiParam({
    name: 'chatId',
    required: true,
    type: Number,
  })
  async unassignChat(
    @GetUser('id') moderatorId: number,
    @Param('chatId', ParseIntPipe) chatId: number,
  ) {
    return this.service.changeChatAssignee(moderatorId, null, chatId);
  }
}
