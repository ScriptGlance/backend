import {Controller, Get, Param, Req, Res} from '@nestjs/common';
import {Request, Response} from "express";
import {SharedVideoService} from "./shared-video.service";
import {ApiTags} from "@nestjs/swagger";

@ApiTags('Shared videos')
@Controller('shared-video')
export class SharedVideoController {
    constructor(private readonly service: SharedVideoService) {}

    @Get(':shareCode')
    async streamByShareCode(
        @Param('shareCode') shareCode: string,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<void> {
        return this.service.streamSharedVideo(shareCode, req, res);
    }
}
