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
  Query, UseInterceptors, NotFoundException, UploadedFile, Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiQuery,
  ApiOperation, ApiConsumes, ApiBody,
} from '@nestjs/swagger';
import { PresentationsService } from './presentations.service';
import { Roles } from '../auth/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UpdatePresentationDto } from './dto/UpdatePresentationDto';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PartUpdateDto } from './dto/PartUpdateDto';
import { PartCreateDto } from './dto/PartCreateDto';
import {FileInterceptor} from "@nestjs/platform-express";
import {diskStorage} from "multer";
import {VideoUploadDto} from "./dto/VideoUploadDto";
import { promisify } from 'util';
import * as fs from "node:fs";
import {Request, Response} from "express";
import {VideoDto} from "./dto/VideoDto";
const unlink = promisify(fs.unlink);

@ApiTags('Presentations')
@ApiBearerAuth()
@Roles('user')
@Controller('presentations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PresentationsController {
  constructor(private readonly service: PresentationsService) {
  }

  @Post()
  async createPresentation(@GetUser('id') userId: number) {
    return {data: await this.service.createPresentation(userId)};
  }

  @Get('stats')
  async getPresentationStatistics(@GetUser('id') userId: number) {
    return {data: await this.service.getPresentationStatistics(userId)};
  }

  @Get()
  @ApiQuery({name: 'limit', required: false, type: Number})
  @ApiQuery({name: 'offset', required: false, type: Number})
  async getPresentations(
      @GetUser('id') userId: number,
      @Query('limit', ParseIntPipe) limit = 10,
      @Query('offset', ParseIntPipe) offset = 0,
  ) {
    const result = await this.service.getPresentations(userId, limit, offset);
    return {data: result};
  }

  @Get(':id')
  async getPresentation(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    return {data: await this.service.getPresentation(userId, id)};
  }

  @Put(':id')
  async updatePresentation(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: UpdatePresentationDto,
  ) {
    return {data: await this.service.updatePresentation(userId, id, dto)};
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
      data: {invitationId: await this.service.inviteParticipant(userId, id)},
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
  @ApiOperation({summary: 'Retrieve presentation structure'})
  async getStructure(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.getStructure(userId, id);
  }

  @Get(':id/parts')
  @ApiOperation({summary: 'List all parts'})
  async listParts(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.service.listParts(userId, id);
  }

  @Post(':id/parts')
  @ApiOperation({summary: 'Create a new part'})
  async createPart(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
      @Body() dto: PartCreateDto,
  ) {
    return await this.service.createPart(userId, id, dto);
  }

  @Put('parts/:part_id')
  @ApiOperation({summary: 'Update part'})
  async updatePart(
      @GetUser('id') userId: number,
      @Param('part_id', ParseIntPipe) partId: number,
      @Body() dto: PartUpdateDto,
  ) {
    return this.service.updatePart(userId, partId, dto);
  }

  @Delete('parts/:part_id')
  @ApiOperation({summary: 'Delete a part'})
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

  @Post(':id/videos')
  @ApiOperation({summary: 'Upload a .webm video for a presentation part'})
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'partName', 'partOrder', 'startTimestamp'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Your .webm video file',
        },
        partName: {type: 'string', description: 'Name of the part'},
        partOrder: {type: 'number', description: 'Order/index of the part'},
        startTimestamp: {
          type: 'number',
          description: 'Recording start timestamp (ms since epoch)',
        },
      },
    },
  })
  @UseInterceptors(
      FileInterceptor('file', {
        storage: diskStorage({
          destination: './uploads/videos',
          filename: (_, file, cb) =>
              cb(null, `${Date.now()}-${file.originalname}`),
        }),
        fileFilter: (_, file, cb) => {
          if (file.mimetype !== 'video/webm') {
            return cb(
                new NotFoundException('Only .webm files are allowed'),
                false,
            );
          }
          cb(null, true);
        },
      }),
  )
  async uploadVideo(
      @Param('id', ParseIntPipe) id: number,
      @GetUser('id') userId: number,
      @UploadedFile() file: Express.Multer.File,
      @Body('partName') partName: string,
      @Body('partOrder', ParseIntPipe) partOrder: number,
      @Body('startTimestamp', ParseIntPipe) startTimestamp: number,
  ) {
    try {
      const dto: VideoUploadDto = {partName, partOrder, startTimestamp};
      return await this.service.uploadPresentationVideo(id, userId, file, dto,);
    } catch (err) {
      if (file?.path) {
        await unlink(file.path).catch(() => {
        });
      }
      throw err;
    }
  }

  @Get('videos/:videoId')
  async streamVideo(
      @Req() req: Request,
      @Res() res: Response,
      @Param('videoId') videoId: number,
      @GetUser('id') userId: number,
  ) {
    return this.service.streamPresentationVideo(
        videoId,
        userId,
        req,
        res,
    );
  }

  @Get(':presentationId/videos')
  async listVideos(
      @Param('presentationId', ParseIntPipe) presentationId: number,
      @GetUser('id') userId: number,
  ) {
    return await this.service.getPresentationVideos(
        presentationId,
        userId,
    );
  }

  @Get('videos/:videoId/share-link')
  async getShareLink(
      @Param('videoId', ParseIntPipe) videoId: number,
      @GetUser('id') userId: number,
  ) {
    return await this.service.getVideoShareCode(videoId, userId);
  }

  @Delete('videos/:videoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeVideo(
      @Param('videoId', ParseIntPipe) videoId: number,
      @GetUser('id') userId: number,
  ): Promise<void> {
    await this.service.removeVideo(
        videoId,
        userId,
    );
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.CREATED)
  async startPresentation(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.startPresentation(userId, id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  async stopPresentation(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    await this.service.stopPresentation(userId, id);
  }

  @Get(':id/active')
  async getActivePresentation(
      @GetUser('id') userId: number,
      @Param('id', ParseIntPipe) id: number,
  ) {
    return { data: await this.service.getActivePresentation(userId, id) };
  }
}
