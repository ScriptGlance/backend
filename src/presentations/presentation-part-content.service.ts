import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { PartTarget } from '../common/enum/PartTarget';

@Injectable()
export class PresentationPartContentService {
  constructor(
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async getPresentationPartContent(
    partId: number,
    target: PartTarget,
    fallback: string,
  ): Promise<{ content: string; version?: number }> {
    const key = `editing:part:${partId}:${target}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      return {
        content: fallback,
      };
    }
    try {
      const { content, version } = JSON.parse(raw) as {
        content: string;
        version: number;
      };
      return { content, version };
    } catch {
      return {
        content: fallback,
      };
    }
  }
}
