import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VideoEntity } from '../common/entities/VideoEntity';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class SharedVideoService {
  constructor(
    @InjectRepository(VideoEntity)
    private readonly videoRepository: Repository<VideoEntity>,
  ) {}

  async streamSharedVideo(shareCode: string, res: Response): Promise<void> {
    const video = await this.getVideoOrThrow(shareCode);
    const { contentType } = this.getVideoFileInfo(video);

    const directVideoUrl = `${process.env.BACKEND_URL}/shared-video/file/${shareCode}`;
    const frontendUrl = `${process.env.FRONTEND_URL}/video/${shareCode}`;

    const posterUrl = video.photoPreviewLink
      ? `${process.env.BACKEND_URL}/${video.photoPreviewLink.replace(/^uploads\//, '')}`
      : '';
    const title = video.title;
    const description = 'Записане відео на платформі "ScriptGlance"';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(HttpStatus.OK).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${title}</title>
          
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${description}" />
          <meta property="og:type" content="video.other" />
          <meta property="og:video" content="${directVideoUrl}" />
          <meta property="og:video:type" content="${contentType}" />
          ${posterUrl ? `<meta property="og:image" content="${posterUrl}" />` : ''}
          <meta property="og:url" content="${frontendUrl}" />
          
          <meta name="twitter:card" content="player">
          <meta name="twitter:title" content="${title}">
          <meta name="twitter:description" content="${description}">
          <meta name="twitter:player" content="${directVideoUrl}">
          ${posterUrl ? `<meta name="twitter:image" content="${posterUrl}">` : ''}
          
          <script>
            if (!/bot|crawl|spider|preview|facebook|twitter|linkedin|slack|discord|whatsapp/i.test(navigator.userAgent)) {
              window.location.href = "${frontendUrl}";
            }
          </script>
        </head>
        <body>
          <h1>${title}</h1>
          <p>${description}</p>
          <video controls ${posterUrl ? `poster="${posterUrl}"` : ''}>
            <source src="${directVideoUrl}" type="${contentType}">
            Your browser does not support the video tag.
          </video>
          <p><a href="${frontendUrl}">Click here to watch the video</a></p>
        </body>
      </html>
    `);
  }

  async streamVideoFile(
    shareCode: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const video = await this.getVideoOrThrow(shareCode);
    const { filePath, contentType } = await this.getVideoFileInfo(video);

    await this.serveVideoFile(filePath, contentType, req, res);
  }

  private async getVideoOrThrow(shareCode: string): Promise<VideoEntity> {
    const video = await this.videoRepository.findOne({
      where: { shareCode },
    });
    if (!video) throw new NotFoundException('Shared video not found');
    return video;
  }

  private getVideoFileInfo(video: VideoEntity): {
    filePath: string;
    contentType: string;
  } {
    const fileName = path.basename(video.link);
    const filePath = path.join(process.cwd(), 'uploads', 'videos', fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Video file not found');
    }

    const contentType = 'video/webm';

    return { filePath, contentType };
  }

  private serveVideoFile(
    filePath: string,
    contentType: string,
    req: Request,
    res: Response,
  ): void {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers['range'];

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunk = end - start + 1;

      res.status(HttpStatus.PARTIAL_CONTENT).set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.toString(),
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.status(HttpStatus.OK).set({
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }
}
