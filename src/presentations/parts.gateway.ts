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
import { IsNull, Repository } from 'typeorm';
import { CursorPositionDto } from './dto/CursorPositionDto';
import { PartTarget } from '../common/enum/PartTarget';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { OperationComponentDto } from './dto/OperationComponentDto';
import { Mutex } from 'async-mutex';
import { TextOperationType } from '../common/enum/TextOperationType';
import { SocketData } from '../common/interface/SocketData';

import { PartEventDto } from './dto/PartEventDto';
import { PresentationStartEntity } from '../common/entities/PresentationStartEntity';
import { BasePresentationGateway } from '../common/base/basePresentation.gateway';
import { PresentationsGateway } from './presentations.gateway';
import { PresentationEventType } from '../common/enum/PresentationEventType';
import { OperationHistoryEntryDto } from './dto/OperationHistoryEntryDto';
import { deepClone, transform } from '../common/utils/OperationalTranformation';

type Socket = BaseSocket<any, any, any, SocketData>;

@WebSocketGateway({ cors: true })
export class PartsGateway
  extends BasePresentationGateway
  implements OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly PENDING_SET = 'editing:part:pending';
  private readonly FLUSH_INTERVAL_MS = 60_000;

  private readonly cursorPositions = new Map<string, CursorPositionDto>();
  private readonly lock = new Mutex();
  private flushInterval: NodeJS.Timeout;

  private lastTextEventEmitTime = new Map<number, number>();
  private readonly pendingEmitTimeouts = new Map<number, NodeJS.Timeout>();
  private readonly TEXT_EVENT_EMIT_INTERVAL_MS = 5000;

  private readonly partOperationHistory = new Map<
    string,
    OperationHistoryEntryDto[]
  >();

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
    private readonly presentationsGateway: PresentationsGateway,
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
    this.partOperationHistory.clear();
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
      try {
        const { content } = JSON.parse(raw) as {
          content: string;
          version: number;
        };
        await this.updatePartContent(partId, target as PartTarget, content);
      } catch (e) {
        console.error(
          `Error parsing Redis content during flush for key ${key}:`,
          e,
        );
      }
      await this.redis.zrem(this.PENDING_SET, key);
    }
  }

  private async updatePartContent(
    partId: number,
    target: PartTarget,
    content: string,
  ) {
    const presentationPart = await this.presentationPartRepository.findOne({
      where: { presentationPartId: partId },
      relations: ['presentation'],
    });
    if (!presentationPart || !presentationPart.presentation) {
      console.warn(
        `updatePartContent: Presentation part or its presentation not found for partId ${partId}`,
      );
      return;
    }
    const presentationStart = await this.presentationStartRepository.findOne({
      where: {
        presentation: {
          presentationId: presentationPart.presentation.presentationId,
        },
        endDate: IsNull(),
      },
    });

    const updateData =
      target === PartTarget.Text ? { text: content } : { name: content };

    if (presentationStart) {
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
    if (!client.data.joinedRooms) client.data.joinedRooms = new Set();
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
    if (!userId) return;
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
        if (key.startsWith(`${userId}:`)) this.cursorPositions.delete(key);
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

      const { content: currentContent, version: currentServerVersion } =
        await this.getContent(redisKey, data.partId, data.target);

      let opsToApply = deepClone(
        data.operations.map((op) => {
          return {
            ...op,
            userId,
          } as OperationComponentDto;
        }),
      );
      const clientBaseVersion = data.baseVersion;

      if (clientBaseVersion < currentServerVersion) {
        const historyToTransformAgainst = (
          this.partOperationHistory.get(redisKey) || []
        )
          .filter(
            (entry) =>
              entry.version > clientBaseVersion &&
              entry.version <= currentServerVersion,
          )
          .sort((a, b) => a.version - b.version);

        if (
          historyToTransformAgainst.length === 0 &&
          clientBaseVersion < currentServerVersion
        ) {
          client.emit(
            'error',
            `Cannot transform operations: Server history missing for versions ${clientBaseVersion + 1}-${currentServerVersion}. Please resync or try again.`,
          );
          return;
        }

        for (const historicalEntry of historyToTransformAgainst) {
          opsToApply = transform(opsToApply, historicalEntry.ops);
        }
      } else if (clientBaseVersion > currentServerVersion) {
        client.emit(
          'error',
          `Client version (${clientBaseVersion}) is ahead of server version (${currentServerVersion}). Please resync.`,
        );

        return;
      }

      const transformedContent = this.applyOperations(
        currentContent,
        opsToApply,
      );

      const newVersion = currentServerVersion + 1;

      if (!this.partOperationHistory.has(redisKey)) {
        this.partOperationHistory.set(redisKey, []);
      }
      this.partOperationHistory
        .get(redisKey)!
        .push({ version: newVersion, ops: opsToApply });

      await this.saveContent(redisKey, transformedContent, newVersion);

      const room = this.getRoomName(presentation.presentationId);

      this.broadcastTextOperation(
        room,
        {
          partId: data.partId,
          target: data.target,
          operations: opsToApply,
          baseVersion: data.baseVersion,
        },
        userId,
        client.id,
        newVersion,
      );

      this.maybeEmitTextChangedEvent(presentation.presentationId);
    });
  }

  private maybeEmitTextChangedEvent(presentationId: number) {
    const now = Date.now();
    const lastEmit = this.lastTextEventEmitTime.get(presentationId) || 0;
    if (now - lastEmit >= this.TEXT_EVENT_EMIT_INTERVAL_MS) {
      this.presentationsGateway.emitPresentationEvent(
        presentationId,
        PresentationEventType.TextChanged,
      );
      this.lastTextEventEmitTime.set(presentationId, now);
      const existingTimeout = this.pendingEmitTimeouts.get(presentationId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        this.pendingEmitTimeouts.delete(presentationId);
      }
    } else {
      if (!this.pendingEmitTimeouts.has(presentationId)) {
        const delay = this.TEXT_EVENT_EMIT_INTERVAL_MS - (now - lastEmit);
        const timeout = setTimeout(() => {
          this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.TextChanged,
          );
          this.lastTextEventEmitTime.set(presentationId, Date.now());
          this.pendingEmitTimeouts.delete(presentationId);
        }, delay);
        this.pendingEmitTimeouts.set(presentationId, timeout);
      }
    }
  }

  private async getPresentationByPartId(partId: number) {
    return this.presentationRepository
      .createQueryBuilder('presentation')
      .leftJoinAndSelect('presentation.owner', 'owner')
      .leftJoinAndSelect('owner.user', 'ownerUser')
      .leftJoinAndSelect('presentation.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .leftJoinAndSelect('presentation.parts', 'part')
      .where('part.presentationPartId = :id', { id: partId })
      .getOne();
  }

  private getRedisKey(partId: number, target: string): string {
    return `editing:part:${partId}:${target}`;
  }

  private async getContent(
    redisKey: string,
    partId: number,
    target: PartTarget,
  ): Promise<{ content: string; version: number }> {
    const existing = await this.redis.get(redisKey);
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as {
          content: string;
          version: number;
        };

        const version = !isNaN(parsed.version) ? parsed.version : 0;
        return { content: parsed.content || '', version };
      } catch (error) {
        console.error(
          `Error parsing Redis content for key ${redisKey}:`,
          error,
          existing,
        );
      }
    }
    const contentFromDb = await this.loadFromDb(partId, target);

    if (
      !this.partOperationHistory.has(redisKey) ||
      this.partOperationHistory.get(redisKey)!.length === 0
    ) {
      if (!existing) {
        await this.saveContent(redisKey, contentFromDb, 0);
      }
    }
    return { content: contentFromDb, version: 0 };
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

  private applyOperations(
    text: string,
    operations: OperationComponentDto[],
  ): string {
    let consumedOriginal = 0;

    let tempResult = '';

    for (const op of operations) {
      if (op.type === TextOperationType.Retain) {
        const count = op.count ?? 0;
        if (count < 0) throw new Error('Retain count cannot be negative.');
        tempResult += text.substring(
          consumedOriginal,
          consumedOriginal + count,
        );
        consumedOriginal += count;
      } else if (op.type === TextOperationType.Insert) {
        const textToInsert = op.text ?? '';
        tempResult += textToInsert;
      } else if (op.type === TextOperationType.Delete) {
        const count = op.count ?? 0;
        if (count < 0) throw new Error('Delete count cannot be negative.');
        consumedOriginal += count;
      }
    }

    if (consumedOriginal < text.length) {
      tempResult += text.substring(consumedOriginal);
    }
    return tempResult;
  }

  private broadcastTextOperation(
    room: string,
    data: {
      partId: number;
      target: PartTarget;
      operations: OperationComponentDto[];
      baseVersion: number;
    },
    userId: number,
    socketId: string,
    appliedVersion: number,
  ): void {
    this.server.to(room).emit('text_operations', {
      ...data,
      userId,
      socketId,
      appliedVersion,
    });
  }

  async loadFromDb(partId: number, target: PartTarget): Promise<string> {
    const selector = target === PartTarget.Name ? 'name' : 'text';
    const part = await this.presentationPartRepository.findOne({
      where: { presentationPartId: partId },
      select: [selector, 'presentationPartId'],
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
      client.emit(
        'error',
        'Not subscribed to text editing for this presentation',
      );
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
      if (Number(keyPresentationId) === presentationId) result.push(value);
    }
    return result;
  }

  public emitPartEvent(presentationId: number, event: PartEventDto) {
    const room = this.getRoomName(presentationId);
    this.server.to(room).emit('partEvent', event);
  }

  public async flushPresentationChanges(presentationId: number): Promise<void> {
    const parts = await this.presentationPartRepository.find({
      where: { presentation: { presentationId } },
    });
    for (const part of parts) {
      for (const target of Object.values(PartTarget) as PartTarget[]) {
        const redisKey = this.getRedisKey(part.presentationPartId, target);
        const score = await this.redis.zscore(this.PENDING_SET, redisKey);
        if (!score) continue;
        const raw = await this.redis.get(redisKey);
        if (raw) {
          try {
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
          } catch (e) {
            console.error(
              `Error parsing Redis content during flushPresentationChanges for key ${redisKey}:`,
              e,
            );
          }
        }
        await this.redis.zrem(this.PENDING_SET, redisKey);
      }
    }
  }
}
