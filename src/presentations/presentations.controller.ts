import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { PresentationsService } from './presentations.service';
import { Roles } from '../auth/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UpdatePresentationDto } from './dto/UpdatePresentationDto';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartUpdateDto } from './dto/PartUpdateDto';
import { PartCreateDto } from './dto/PartCreateDto';

@ApiTags('Presentations')
@ApiBearerAuth()
@Roles('user')
@Controller('presentations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresentationsController {
  constructor(private readonly service: PresentationsService) {}

  @Post()
  async createPresentation(@GetUser('id') userId: number) {
    return { data: await this.service.createPresentation(userId) };
  }

  @Get('stats')
  async getPresentationStatistics(@GetUser('id') userId: number) {
    return { data: await this.service.getPresentationStatistics(userId) };
  }

  @Get()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getPresentations(
    @GetUser('id') userId: number,
    @Query('limit', ParseIntPipe) limit = 10,
    @Query('offset', ParseIntPipe) offset = 0,
  ) {
    const result = await this.service.getPresentations(userId, limit, offset);
    return { data: result };
  }

  @Get(':id')
  async getPresentation(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return { data: await this.service.getPresentation(userId, id) };
  }

  @Put(':id')
  async updatePresentation(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePresentationDto,
  ) {
    return { data: await this.service.updatePresentation(userId, id, dto) };
  }

  @Delete(':id')
  async removePresentation(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.removePresentation(userId, id);
  }

  @Get(':id/participants')
  async getParticipants(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.getParticipants(userId, id);
  }

  @Delete('participants/:id')
  async removeParticipant(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.removeParticipant(userId, id);
  }

  @Post(':id/invite')
  async inviteParticipant(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return {
      data: { invitationId: await this.service.inviteParticipant(userId, id) },
    };
  }

  @Post('invitations/:token/accept')
  async acceptInvitation(
    @GetUser('id') userId: number,
    @Param('token') token: string,
  ) {
    await this.service.acceptInvitation(userId, token);
  }

  @Get(':id/structure')
  @ApiOperation({ summary: 'Retrieve presentation structure' })
  async getStructure(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.getStructure(userId, id);
  }

  @Get(':id/parts')
  @ApiOperation({ summary: 'List all parts' })
  async listParts(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.listParts(userId, id);
  }

  @Post(':id/parts')
  @ApiOperation({ summary: 'Create a new part' })
  async createPart(
    @GetUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PartCreateDto,
  ) {
    return await this.service.createPart(userId, id, dto);
  }

  @Put('parts/:part_id')
  @ApiOperation({ summary: 'Update part' })
  async updatePart(
    @GetUser('id') userId: number,
    @Param('part_id', ParseIntPipe) partId: number,
    @Body() dto: PartUpdateDto,
  ) {
    return this.service.updatePart(userId, partId, dto);
  }

  @Delete('parts/:part_id')
  @ApiOperation({ summary: 'Delete a part' })
  async deletePart(
    @GetUser('id') userId: number,
    @Param('part_id', ParseIntPipe) partId: number,
  ) {
    return await this.service.deletePart(userId, partId);
  }

  @Get(':id/text/cursor-positions')
  async getPresentationCursorPositions(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.getPresentationCursorPositions(userId, id);
  }
}
