import {HttpStatus, Injectable, NotFoundException} from '@nestjs/common';
import {Request, Response} from "express";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {VideoEntity} from "../common/entities/VideoEntity";
import * as path from 'path';
import * as fs from 'fs';



@Injectable()
export class SharedVideoService {
    constructor(
        @InjectRepository(VideoEntity)
        private readonly videoRepository: Repository<VideoEntity>,
    ) {}

    async streamSharedVideo(
        shareCode: string,
        req: Request,
        res: Response,
    ): Promise<void> {
        const video = await this.videoRepository.findOne({
            where: {shareCode},
        });
        if (!video) throw new NotFoundException('Shared video not found');

        const fileName = path.basename(video.link);
        const filePath = path.join(process.cwd(), 'uploads', 'videos', fileName);
        if (!fs.existsSync(filePath)) {
            throw new NotFoundException('File not found');
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers['range'] as string | undefined;

        if (range) {
            const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
            const chunk = end - start + 1;

            res
                .status(HttpStatus.PARTIAL_CONTENT)
                .set({
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunk.toString(),
                    'Content-Type': 'video/webm',
                });
            fs.createReadStream(filePath, {start, end}).pipe(res);
        } else {
            res
                .status(HttpStatus.OK)
                .set({
                    'Content-Length': fileSize.toString(),
                    'Content-Type': 'video/webm',
                });
            fs.createReadStream(filePath).pipe(res);
        }
    }
}