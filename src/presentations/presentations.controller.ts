import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards, Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PresentationsService } from './presentations.service';
import { Roles } from '../auth/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UpdatePresentationDto } from './dto/UpdatePresentationDto';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Presentations')
@ApiBearerAuth()
@Roles('user')
@Controller('presentations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresentationsController {
  constructor(private readonly service: PresentationsService) {}

  @Post()
  async create(@GetUser('id') userId: number) {
    return { data: await this.service.create(userId) };
  }

  @Get('stats')
  async stats(@GetUser('id') userId: number) {
    return { data: await this.service.getStats(userId) };
  }

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async list(
    @GetUser('id') userId: number,
    @Query('limit', ParseIntPipe) limit = 10,
    @Query('offset', ParseIntPipe) offset = 0,
  ) {
    const result = await this.service.findAll(userId, limit, offset);
    return { data: result };
  }

  @Get(':id')
  async findOne(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { data: await this.service.findOne(userId, id) };
  }

  @Put(':id')
  async update(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePresentationDto,
  ) {
    return { data: await this.service.update(userId, id, dto) };
  }

  @Delete(':id')
  async remove(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.remove(userId, id);
  }

  @Get(':id/participants')
  async getParticipants(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.listParticipants(userId, id);
  }

  @Delete('participants/:id')
  async removeParticipant(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.removeParticipant(userId, id);
  }

  @Post(':id/invite')
  async invite(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { data: { invitationId: await this.service.invite(userId, id) } };
  }

  @Post('invitations/:token/accept')
  async accept(@GetUser('id') userId: number, @Param('token') token: string) {
    await this.service.acceptInvitation(userId, token);
  }
}
