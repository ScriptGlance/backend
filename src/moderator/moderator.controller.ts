import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Put,
    UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {ApiBearerAuth, ApiBody, ApiConsumes, ApiTags} from '@nestjs/swagger';
import {GetUser} from "../common/decorators/get-user.decorator";
import {promisify} from "util";
import * as fs from 'node:fs';
import {FileInterceptor} from "@nestjs/platform-express";
import {diskStorage} from "multer";
import {ModeratorService} from "./moderator.service";

const unlink = promisify(fs.unlink);

@Controller('moderator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('moderator')
@ApiBearerAuth()
@ApiTags('Moderator')
export class ModeratorController {
    constructor(private readonly service: ModeratorService) {}

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
                first_name: { type: 'string' },
                last_name: { type: 'string' },
                password: { type: 'string' },
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
        @GetUser('id') moderatorId: number,
        @UploadedFile() avatar: Express.Multer.File | null,
        @Body('first_name') firstName: string,
        @Body('last_name') lastName: string,
        @Body('password') password: string = '',
    ) {
        try {
            return await this.service.changeProfile(moderatorId, firstName, lastName, avatar, password);
        } catch (err) {
            if (avatar?.path) {
                await unlink(avatar.path).catch(() => {});
            }
            throw err;
        }
    }
}


