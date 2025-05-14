import {
    BadRequestException, Body,
    Controller, Delete,
    Get, Param,
    ParseIntPipe, Post,
    Put,
    Query, UploadedFile,
    UseGuards,
    UseInterceptors
} from '@nestjs/common';
import {Roles} from "../auth/roles.decorator";
import {ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags} from "@nestjs/swagger";
import {JwtAuthGuard} from "../auth/jwt-auth.guard";
import {RolesGuard} from "../auth/roles.guard";
import {AdminService} from "./admin.service";
import {FileInterceptor} from "@nestjs/platform-express";
import {diskStorage} from "multer";
import {promisify} from "util";
import * as fs from 'node:fs';
import {UserService} from "../user/user.service";
import {ModeratorService} from "../moderator/moderator.service";
import {RegisterDto} from "../auth/dto/RegisterDto";
import {InviteDto} from "./dto/InviteDto";

const unlink = promisify(fs.unlink);

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@ApiBearerAuth()
@ApiTags('Admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly userService: UserService,
        private readonly moderatorService: ModeratorService,
    ) {}

    @Get('users')
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
        name: 'sort',
        required: true,
        type: String,
        example: 'registeredAt',
    })
    @ApiQuery({
        name: 'order',
        required: true,
        type: String,
        example: 'asc',
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        example: '',
    })
    async getUsers(
        @Query('limit', ParseIntPipe) limit = 20,
        @Query('offset', ParseIntPipe) offset = 0,
        @Query('sort') sort: 'registeredAt' | 'name' | 'email',
        @Query('order') order: 'asc' | 'desc',
        @Query('search') search: string = '',
    ) {
        return await this.adminService.getUsers({
            limit,
            offset,
            sort,
            order,
            search,
        });
    }

    @Get('moderators')
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
        name: 'sort',
        required: true,
        type: String,
        example: 'joinedAt',
    })
    @ApiQuery({
        name: 'order',
        required: true,
        type: String,
        example: 'asc',
    })
    @ApiQuery({
        name: 'search',
        required: false,
        type: String,
        example: '',
    })
    async getModerators(
        @Query('limit', ParseIntPipe) limit = 20,
        @Query('offset', ParseIntPipe) offset = 0,
        @Query('sort') sort: 'joinedAt' | 'name' | 'email',
        @Query('order') order: 'asc' | 'desc',
        @Query('search') search: string = '',
    ) {
        return await this.adminService.getModerators({
            limit,
            offset,
            sort,
            order,
            search,
        });
    }

    @Put('user/:id')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['first_name', 'last_name'],
            properties: {
                avatar: {
                    type: 'string',
                    format: 'binary',
                },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
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
    async changeUserProfile(
        @Param('id') userId: number,
        @UploadedFile() avatar: Express.Multer.File | null,
        @Body('first_name') firstName: string,
        @Body('last_name') lastName: string,
    ) {
        try {
            return await this.userService.changeProfile(userId, firstName, lastName, avatar);
        } catch (err) {
            if (avatar?.path) {
                await unlink(avatar.path).catch(() => {});
            }
            throw err;
        }
    }

    @Put('moderator/:id')
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['first_name', 'last_name'],
            properties: {
                avatar: {
                    type: 'string',
                    format: 'binary',
                },
                first_name: { type: 'string' },
                last_name: { type: 'string' },
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
    async changeModeratorProfile(
        @Param('id') moderatorId: number,
        @UploadedFile() avatar: Express.Multer.File | null,
        @Body('first_name') firstName: string,
        @Body('last_name') lastName: string,
    ) {
        try {
            return await this.moderatorService.changeProfile(moderatorId, firstName, lastName, avatar);
        } catch (err) {
            if (avatar?.path) {
                await unlink(avatar.path).catch(() => {});
            }
            throw err;
        }
    }

    @Delete('user/:id')
    async deleteUser(@Param('id') userId: number) {
        return await this.adminService.deleteUser(userId);
    }

    @Delete('moderator/:id')
    async deleteModerator(@Param('id') moderatorId: number) {
        return await this.adminService.deleteModerator(moderatorId);
    }

    @Post('user/invite')
    @ApiBody({ type: InviteDto})
    async inviteUser(@Body() inviteDto: InviteDto) {
        return this.adminService.inviteUser(inviteDto);
    }

    @Post('moderator/invite')
    @ApiBody({ type: InviteDto})
    async inviteModerator(@Body() inviteDto: InviteDto) {
        return this.adminService.inviteModerator(inviteDto);
    }

    @Get('stats/daily')
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
    async getDailyStatistics(
        @Query('limit', ParseIntPipe) limit = 20,
        @Query('offset', ParseIntPipe) offset = 0,
    ) {
        return await this.adminService.getDailyStatistics(limit, offset);
    }

    @Get('stats/monthly')
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
    async getMonthlyStatistics(
        @Query('limit', ParseIntPipe) limit = 20,
        @Query('offset', ParseIntPipe) offset = 0,
    ) {
        return await this.adminService.getMonthlyStatistics(limit, offset);
    }
}
