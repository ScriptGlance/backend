import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket as BaseSocket } from 'socket.io';
import Redis from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { PresenceDto } from './dto/EditingPresenceDto';
import { PresenceEventType } from '../common/enum/PresenceEventType';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import {IsNull, Repository} from 'typeorm';
import { CursorPositionDto } from './dto/CursorPositionDto';
import { PartTarget } from '../common/enum/PartTarget';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { OperationComponentDto } from './dto/OpearationComponent';
import { Mutex } from 'async-mutex';
import { TextOperationType } from '../common/enum/TextOperationType';
import { SocketData } from '../common/interface/SocketData';
import { BaseGateway } from '../common/base/base.gateway';
import { PartEventDto } from './dto/PartEventDto';
import {PresentationStartEntity} from "../common/entities/PresentationStartEntity";

type Socket = BaseSocket<any, any, any, SocketData>;

/**
 * WebSocket gateway for real-time collaborative text editing
 */
@WebSocketGateway({ cors: true })
export class PartsGateway
  extends BaseGateway
  implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly PENDING_SET = 'editing:part:pending';
  private readonly FLUSH_INTERVAL_MS = 60_000;

  private readonly cursorPositions = new Map<string, CursorPositionDto>();
  private readonly lock = new Mutex();
  private flushInterval: NodeJS.Timeout;

  constructor(
    jwtService: JwtService,
    configService: ConfigService,
    @InjectRepository(PresentationEntity)
    presentationRepository: Repository<PresentationEntity>,
    @InjectRepository(PresentationPartEntity)
    private readonly presentationPartRepository: Repository<PresentationPartEntity>,
    @InjectRepository(PresentationStartEntity)
    private readonly presentationStartRepository: Repository<PresentationStartEntity>,
    @InjectRedis() private redis: Redis,
  ) {
    super(jwtService, configService, presentationRepository);
  }

  onModuleInit() {
    this.flushInterval = setInterval(() => {
      this.flushAllChanges().catch((error) => {
        console.error('Error during flushing all changes:', error);
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
  }

  private async flushAllChanges() {
    const cutoff = Date.now() - this.FLUSH_INTERVAL_MS;
    const staleKeys = await this.redis.zrangebyscore(
      this.PENDING_SET,
      0,
      cutoff,
    );

    for (const key of staleKeys) {
      const [, , partIdStr, target] = key.split(':');
      const partId = Number(partIdStr);

      const raw = await this.redis.get(key);
      if (!raw) {
        await this.redis.zrem(this.PENDING_SET, key);
        continue;
      }

      const { content } = JSON.parse(raw) as {
        content: string;
        version: number;
      };

      await this.updatePartContent(partId, target as PartTarget, content);
      await this.redis.zrem(this.PENDING_SET, key);
    }
  }

  private async updatePartContent(
    partId: number,
    target: PartTarget,
    content: string,
  ) {
    const presentation = await this.presentationPartRepository.find({
      where: { presentationPartId: partId },
    });
    if (!presentation) {
      return;
    }
    const presentationStart = await this.presentationStartRepository.findOne({
      where: { presentation, endDate: IsNull() }
    });
    const updateData = target === PartTarget.Text ? { text: content } : { name: content };
    if(presentationStart) {
      return;
    }
    await this.presentationPartRepository.update(
      { presentationPartId: partId },
      updateData,
    );
  }

  @SubscribeMessage('subscribe_text')
  async onSubscribeText(
    @MessageBody() data: { presentationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.id;

    if (!userId) {
      client.emit('error', 'User not authenticated');
      return;
    }

    const presentation = await this.getPresentationWithAccessControl(
      data.presentationId,
      userId,
    );
    if (!presentation) {
      client.emit('error', 'Access denied to presentation');
      return;
    }

    const room = this.getRoomName(data.presentationId);
    await this.addClientToRoom(
      client,
      room,
      userId,
      presentation.presentationId,
    );
  }

  private async addClientToRoom(
    client: Socket,
    room: string,
    userId: number,
    presentationId: number,
  ) {
    await client.join(room);

    if (!client.data.joinedRooms) {
      client.data.joinedRooms = new Set();
    }
    client.data.joinedRooms.add(room);

    this.cursorPositions.set(
      this.getCursorPositionKey(userId, presentationId),
      new CursorPositionDto(userId),
    );

    client.broadcast
      .to(room)
      .emit(
        'editing_presence',
        new PresenceDto(userId, PresenceEventType.UserJoined),
      );
  }

  handleDisconnect(client: Socket) {
    const rooms = client.data.joinedRooms || new Set<string>();
    const userId = client.data.user?.id;

    if (!userId) {
      return;
    }

    this.notifyUserLeftRooms(rooms, userId);
    this.cleanupCursorPositions(userId);
  }

  private notifyUserLeftRooms(rooms: Set<string>, userId: number) {
    for (const room of rooms) {
      this.server
        .to(room)
        .emit(
          'editing_presence',
          new PresenceDto(userId, PresenceEventType.UserLeft),
        );
    }
  }

  private cleanupCursorPositions(userId: number) {
    if (userId) {
      for (const key of this.cursorPositions.keys()) {
        if (key.startsWith(`${userId}:`)) {
          this.cursorPositions.delete(key);
        }
      }
    }
  }

  @SubscribeMessage('text_operations')
  async onTextOperation(
    @MessageBody()
    data: {
      partId: number;
      baseVersion: number;
      operations: OperationComponentDto[];
      target: PartTarget;
    },
    @ConnectedSocket() client: Socket,
  ) {
    await this.lock.runExclusive(async () => {
      const userId = client.data.user?.id;

      if (!userId) {
        client.emit('error', 'User not authenticated');
        return;
      }

      const presentation = await this.getPresentationByPartId(data.partId);
      if (
        !presentation ||
        !this.userHasAccessToPresentation(presentation, userId)
      ) {
        client.emit('error', 'Access denied to presentation');
        return;
      }

      const redisKey = this.getRedisKey(data.partId, data.target);
      const content = await this.getContent(redisKey, data.partId, data.target);
      const transformed = this.applyOperations(content, data.operations);

      await this.saveContent(redisKey, transformed, data.baseVersion + 1);

      const room = this.getRoomName(presentation.presentationId);
      this.broadcastTextOperation(room, data, userId, data.baseVersion + 1);
    });
  }

  private async getPresentationByPartId(partId: number) {
    return this.presentationRepository
        .createQueryBuilder('presentation')
        .leftJoinAndSelect('presentation.owner', 'owner')
        .leftJoinAndSelect('owner.user', 'ownerUser')
        .leftJoinAndSelect('presentation.participants', 'participant')
        .leftJoinAndSelect('participant.user', 'participantUser')
        .leftJoinAndSelect('presentation.parts', 'part')
        .where('part.presentationPartId = :id', {id: partId})
        .getOne();
  }

  private getRedisKey(partId: number, target: string): string {
    return `editing:part:${partId}:${target}`;
  }

  private async getContent(
    redisKey: string,
    partId: number,
    target: PartTarget,
  ): Promise<string> {
    const existing = await this.redis.get(redisKey);

    if (existing) {
      const parsed = JSON.parse(existing) as {
        content: string;
        version: number;
      };
      return parsed.content;
    } else {
      return await this.loadFromDb(partId, target);
    }
  }

  private async saveContent(
    redisKey: string,
    content: string,
    newVersion: number,
  ): Promise<void> {
    const newData = { content, version: newVersion };

    await this.redis
      .multi()
      .set(redisKey, JSON.stringify(newData))
      .zadd(this.PENDING_SET, Date.now(), redisKey)
      .exec();
  }

  private broadcastTextOperation(
    room: string,
    data: any,
    userId: number,
    newVersion: number,
  ): void {
    this.server.to(room).emit('text_operations', {
      ...data,
      userId,
      appliedVersion: newVersion,
    });
  }

  applyOperations(text: string, operations: OperationComponentDto[]): string {
    let result = '';
    let index = 0;

    for (const operation of operations) {
      switch (operation.type) {
        case TextOperationType.Retain:
          if (typeof operation.count !== 'number') {
            throw new Error('Retain operation missing count');
          }
          result += text.slice(index, index + operation.count);
          index += operation.count;
          break;

        case TextOperationType.Insert:
          if (typeof operation.text !== 'string') {
            throw new Error('Insert operation missing text');
          }
          result += operation.text;
          break;

        case TextOperationType.Delete:
          if (typeof operation.count !== 'number') {
            throw new Error('Delete operation missing count');
          }
          index += operation.count;
          break;
      }
    }

    result += text.slice(index);
    return result;
  }

  async loadFromDb(partId: number, target: PartTarget): Promise<string> {
    const selector = target === PartTarget.Name ? 'name' : 'text';
    const part = await this.presentationPartRepository.findOne({
      where: { presentationPartId: partId },
      select: [selector],
    });
    return part?.[selector] ?? '';
  }

  @SubscribeMessage('cursor_position_change')
  async onCursorPositionChange(
    @MessageBody()
    data: {
      part_id: number;
      cursor_position: number;
      selection_anchor_position?: number;
      target: PartTarget;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.id;

    if (!userId) {
      client.emit('error', 'User not authenticated');
      return;
    }

    const presentation = await this.getPresentationByPartId(data.part_id);
    if (
      !presentation ||
      !this.userHasAccessToPresentation(presentation, userId)
    ) {
      client.emit('error', 'Access denied to presentation');
      return;
    }

    const room = this.getRoomName(presentation.presentationId);
    if (!client.rooms.has(room)) {
      client.emit('error', 'Not subscribed to text editing');
      return;
    }

    const dto = new CursorPositionDto(
      userId,
      data.part_id,
      data.cursor_position,
      data.target,
      data.selection_anchor_position,
    );

    this.cursorPositions.set(
      this.getCursorPositionKey(userId, presentation.presentationId),
      dto,
    );

    client.broadcast.to(room).emit('cursor_position_change', dto);
  }

  private getRoomName(presentationId: number): string {
    return `presentation/${presentationId}/text-editing`;
  }

  private getCursorPositionKey(userId: number, presentationId: number): string {
    return `${userId}:${presentationId}`;
  }

  public getCursorPositionsForPresentation(
    presentationId: number,
  ): CursorPositionDto[] {
    const result: CursorPositionDto[] = [];
    for (const [key, value] of this.cursorPositions.entries()) {
      const [, keyPresentationId] = key.split(':');
      if (Number(keyPresentationId) === presentationId) {
        result.push(value);
      }
    }
    return result;
  }

  public emitPartEvent(presentationId: number, event: PartEventDto) {
    const room = this.getRoomName(presentationId);
    this.server.to(room).emit('partEvent', event);
  }

  public async flushPresentationChanges(
      presentationId: number,
  ): Promise<void> {
    const parts = await this.presentationPartRepository.find({
      where: { presentation: { presentationId } },
    });

    for (const part of parts) {
      for (const target of Object.values(PartTarget) as PartTarget[]) {
        const redisKey = this.getRedisKey(part.presentationPartId, target);

        const score = await this.redis.zscore(this.PENDING_SET, redisKey);
        if (!score) {
          continue;
        }

        const raw = await this.redis.get(redisKey);
        if (raw) {
          const { content } = JSON.parse(raw) as {
            content: string;
            version: number;
          };

          const updateData =
              target === PartTarget.Text
                  ? { text: content }
                  : { name: content };
          await this.presentationPartRepository.update(
              { presentationPartId: part.presentationPartId },
              updateData,
          );
        }

        await this.redis.zrem(this.PENDING_SET, redisKey);
      }
    }
  }
}
