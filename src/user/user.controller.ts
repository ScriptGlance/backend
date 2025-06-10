import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { GetUser } from '../common/decorators/get-user.decorator';
import { promisify } from 'util';
import * as fs from 'node:fs';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

const unlink = promisify(fs.unlink);

@Controller('user')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('user')
@ApiBearerAuth()
@ApiTags('User')
export class UserController {
  constructor(private readonly service: UserService) {}

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  @Get('profile')
  async getProfile(@GetUser('id') userId: number) {
    return this.service.getProfile(userId);
  }

  @Put('profile')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
        },
        first_name: { type: 'string', default: '' },
        last_name: { type: 'string', default: '' },
        password: { type: 'string', default: '' },
        fcm_token: { type: 'string', default: '' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname}`),
      }),
      fileFilter: (_, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException('Only image files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async changeProfile(
    @GetUser('id') userId: number,
    @UploadedFile() avatar: Express.Multer.File | null,
    @Body('first_name') firstName: string = '',
    @Body('last_name') lastName: string = '',
    @Body('password') password: string = '',
    @Body('fcm_token') fcmToken: string = '',
  ) {
    try {
      return await this.service.changeProfile(
        userId,
        firstName,
        lastName,
        avatar,
        password,
        fcmToken,
      );
    } catch (err) {
      if (avatar?.path) {
        await unlink(avatar.path).catch(() => {});
      }
      throw err;
    }
  }
}
