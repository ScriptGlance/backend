import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PresenceDto } from './dto/EditingPresenceDto';
import { PresenceEventType } from '../common/enum/PresenceEventType';
import { PartStructureDto } from './dto/PartStructureDto';
import { ReadingPositionDto } from './dto/ReadingPositionDto';
import { InjectRepository } from '@nestjs/typeorm';
import { PresentationPartEntity } from '../common/entities/PresentationPartEntity';
import { IsNull, Repository } from 'typeorm';
import { ActivePresentationDto } from './dto/ActivePresentationDto';
import { ActivePresentationWithUsersDto } from './dto/ActivePresentationWithUsersDto';
import { Mutex } from 'async-mutex';
import { PresentationStartEntity } from '../common/entities/PresentationStartEntity';
import { PresentationEventType } from '../common/enum/PresentationEventType';
import { PresentationsGateway } from './presentations.gateway';
import {
  ConflictException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import { OwnerChangeEventDto } from './dto/OwnerChangeEventDto';
import { JoinedUserDto } from './dto/JoinedUserDto';
import { RecordingModeChangeDto } from './dto/RecordingModeChangeDto';
import { UserRecordedVideosDto } from './dto/UserRecordedVideosDto';
import { RecordedVideosCountChangeEventDto } from './dto/RecordedVideosCountChangeEventDto';
import { PartReassignReason } from '../common/enum/PartReassignReason';
import { WaitingForUserEventDto } from './dto/WaitingForUserEventDto';
import { PartReadingConfirmationRequiredEventDto } from './dto/PartReadingConfirmationRequiredEventDto';
import {
  NOTIFICATION_PART_NAME_PLACEHOLDER,
  NOTIFICATION_PRESENTATION_NAME_PLACEHOLDER,
  TIME_TO_CONFIRM_PART_READING_SECONDS,
  WAITING_FOR_USER_NOTIFICATION_BODY,
  WAITING_FOR_USER_NOTIFICATION_TITLE,
  YOUR_PART_REASSIGNED_NOTIFICATION_BODY,
  YOUR_PART_REASSIGNED_NOTIFICATION_TITLE,
} from '../common/Constants';
import { BasePresentationGateway } from '../common/base/basePresentation.gateway';
import { PresentationPartContentService } from './presentation-part-content.service';
import { PartTarget } from '../common/enum/PartTarget';
import { NotificationsService } from '../notifications/notifications.service';
import { Socket as BaseSocket } from 'socket.io/dist/socket';
import { SocketData } from '../common/interface/SocketData';
import { UserEntity } from '../common/entities/UserEntity';

type Socket = BaseSocket<any, any, any, SocketData>;
type TeleprompterSocketData = { user?: { id: number } };
type TeleprompterSocket = Socket & { data: TeleprompterSocketData };

@WebSocketGateway({ cors: true, namespace: 'teleprompter' })
export class TeleprompterGateway
  extends BasePresentationGateway
  implements OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly joinedUsers = new Map<number, Set<JoinedUserDto>>();
  private readonly redisKeyPrefix = 'teleprompter:session:';
  private readonly mutex = new Mutex();
  private readonly stopTimers = new Map<number, NodeJS.Timeout>();
  private readonly ownerChangeTimers = new Map<number, NodeJS.Timeout>();
  private readonly DELAY_BEFORE_STOP_MS = 1000;
  private readonly confirmationTimers = new Map<number, NodeJS.Timeout>();
  private readonly DELAY_BETWEEN_PARTS_MS = 1000;

  constructor(
    jwtService: JwtService,
    configService: ConfigService,
    @InjectRepository(PresentationEntity)
    presentationRepository: Repository<PresentationEntity>,
    @InjectRedis()
    private readonly redis: Redis,
    @InjectRepository(PresentationPartEntity)
    private readonly presentationPartRepository: Repository<PresentationPartEntity>,
    @InjectRepository(PresentationStartEntity)
    private readonly presentationStartRepository: Repository<PresentationStartEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly presentationsGateway: PresentationsGateway,
    private readonly presentationPartContentService: PresentationPartContentService,
    private readonly notificationsService: NotificationsService,
  ) {
    super(jwtService, configService, presentationRepository);
  }

  async onModuleInit() {
    const keys = await this.redis.keys(`${this.redisKeyPrefix}*`);
    for (const key of keys) {
      const idStr = key.replace(this.redisKeyPrefix, '');
      const presentationId = Number(idStr);
      if (!isNaN(presentationId)) {
        await this.stopPresentation(presentationId);
        await this.redis.del(key);
      }
    }
  }

  @SubscribeMessage('subscribe_teleprompter')
  async handleSubscription(
    @MessageBody() data: { presentationId: number },
    @ConnectedSocket() client: TeleprompterSocket,
  ) {
    try {
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
      }

      const room = this.getRoomName(data.presentationId);
      await client.join(room);
      if (!this.joinedUsers.has(data.presentationId)) {
        const users = new Set<JoinedUserDto>();
        users.add(new JoinedUserDto(userId));
        this.joinedUsers.set(data.presentationId, users);
        const session = await this.initializeSessionInRedis(
          data.presentationId,
          false,
        );
        this.emitOwnerChangeEvent(
          data.presentationId,
          session.currentOwnerUserId,
        );
      } else {
        const users = this.joinedUsers.get(data.presentationId)!;
        if (![...users].some((user) => user.userId === userId)) {
          this.joinedUsers
            .get(data.presentationId)!
            .add(new JoinedUserDto(userId));
        }

        const session = await this.getActiveSession(data.presentationId);
        if (!session) {
          return;
        }
        if (
          session.currentPresentationStartDate &&
          this.getActiveReaderId(session) === userId
        ) {
          await this.emitPartReassignCancelledEvent(data.presentationId);
          if (session.awaitingConfirmationUserId) {
            await this.emitPartReadingConfirmationCancelledEvent(
              data.presentationId,
              session.awaitingConfirmationUserId,
            );
            session.awaitingConfirmationUserId = undefined;
            await this.setActiveSession(data.presentationId, session);
          }
          await this.emitPartReadingConfirmationRequiredEvent(
            data.presentationId,
            userId,
          );

          session.missingUserId = undefined;
          await this.setActiveSession(data.presentationId, session);
        }

        await this.checkOwnerChange(data.presentationId, 300);
      }
      client.broadcast
        .to(room)
        .emit(
          'teleprompter_presence',
          new PresenceDto(userId, PresenceEventType.UserJoined),
        );
      this.presentationsGateway.emitPresentationEvent(
        data.presentationId,
        PresentationEventType.JoinedUsersChanged,
      );
    } catch (error) {
      console.error('Teleprompter subscribe error:', error);
      client.emit('error', 'Failed to subscribe to teleprompter');
    }
  }

  private async checkOwnerChange(
    presentationId: number,
    reassignRequiredSendTimeoutMs: number = 0,
  ) {
    const session = await this.getActiveSession(presentationId);
    const currentOwnerUserId = await this.getCurrentOwnerUserId(presentationId);
    if (currentOwnerUserId && session) {
      const previousOwnerUserId = session.currentOwnerUserId;
      session.currentOwnerUserId = currentOwnerUserId;
      this.emitOwnerChangeEvent(presentationId, session.currentOwnerUserId);
      await this.setActiveSession(presentationId, session);

      if (session.currentPresentationStartDate && session.missingUserId) {
        setTimeout(async () => {
          await this.emitPartReassignRequiredEvent(
            presentationId,
            session.missingUserId!,
            session.currentReadingPosition.partId,
            PartReassignReason.MissingAssignee,
          );
        }, reassignRequiredSendTimeoutMs);

        if (
          previousOwnerUserId !== currentOwnerUserId &&
          this.isUserJoined(presentationId, previousOwnerUserId)
        ) {
          await this.emitPartReassignCancelledEvent(
            presentationId,
            previousOwnerUserId,
          );
        }
      }
    }
  }

  async handleDisconnect(client: TeleprompterSocket) {
    const userId = client.data.user?.id;
    if (!userId) return;

    await this.mutex.runExclusive(async () => {
      for (const [presentationId, users] of this.joinedUsers.entries()) {
        const user = Array.from(users ?? []).find(
          (user) => user.userId === userId,
        );
        if (user) {
          users.delete(user);
          const room = this.getRoomName(presentationId);
          this.server
            .to(room)
            .emit(
              'teleprompter_presence',
              new PresenceDto(userId, PresenceEventType.UserLeft),
            );

          const session = await this.getActiveSession(presentationId);
          if (
            session &&
            session.awaitingConfirmationUserId === userId &&
            this.confirmationTimers.has(presentationId)
          ) {
            clearTimeout(this.confirmationTimers.get(presentationId));
            this.confirmationTimers.delete(presentationId);

            await this.emitPartReadingConfirmationCancelledEvent(
              presentationId,
              userId,
            );

            session.awaitingConfirmationUserId = undefined;
            session.confirmationRequestSentTime = undefined;
          }

          if (users.size === 0) {
            if (!this.stopTimers.has(presentationId)) {
              const timer = setTimeout(() => {
                if ((this.joinedUsers.get(presentationId)?.size ?? 0) === 0) {
                  this.stopPresentation(presentationId).catch((err) =>
                    console.error('Stop presentation error:', err),
                  );
                  this.joinedUsers.delete(presentationId);
                }
                this.stopTimers.delete(presentationId);
              }, this.DELAY_BEFORE_STOP_MS);
              this.stopTimers.set(presentationId, timer);
            }
          } else {
            if (this.ownerChangeTimers.has(presentationId)) {
              clearTimeout(this.ownerChangeTimers.get(presentationId));
              this.ownerChangeTimers.delete(presentationId);
            }
            setTimeout(() => {
              this.checkOwnerChange(presentationId).catch((err) => {
                console.error('Owner change error:', err);
              });
              this.ownerChangeTimers.delete(presentationId);
            }, this.DELAY_BEFORE_STOP_MS);
            if (this.stopTimers.has(presentationId)) {
              clearTimeout(this.stopTimers.get(presentationId));
              this.stopTimers.delete(presentationId);
            }
          }

          this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.JoinedUsersChanged,
          );
          if (!session || !session.currentPresentationStartDate) {
            return;
          }
          await this.checkCurrentReaderAvailability(presentationId, session);
        }
      }
    });
  }

  private async stopPresentation(presentationId: number) {
    const activeSession = await this.presentationStartRepository.findOne({
      where: { presentation: { presentationId }, endDate: IsNull() },
    });
    if (!activeSession) {
      return;
    }
    activeSession.endDate = new Date();
    await this.presentationStartRepository.save(activeSession);
    this.presentationsGateway.emitPresentationEvent(
      presentationId,
      PresentationEventType.PresentationStopped,
    );
    await this.setTeleprompterState(presentationId, false);
  }

  private getRoomName(presentationId: number): string {
    return `presentation/${presentationId}/teleprompter`;
  }

  private emitOwnerChangeEvent(presentationId: number, newOwnerUserId: number) {
    const room = this.getRoomName(presentationId);
    this.server
      .to(room)
      .emit('owner_changed', new OwnerChangeEventDto(newOwnerUserId));
  }

  private emitRecordingModeChange(
    presentationId: number,
    userId: number,
    isActive: boolean,
  ) {
    const room = this.getRoomName(presentationId);
    this.server
      .to(room)
      .emit(
        'recording_mode_changed',
        new RecordingModeChangeDto(userId, isActive),
      );
  }

  private emitRecordedVideosCountChange(
    presentationId: number,
    userId: number,
    recordedVideosCount: number,
  ) {
    const room = this.getRoomName(presentationId);
    this.server
      .to(room)
      .emit(
        'recorded_videos_count_change',
        new RecordedVideosCountChangeEventDto(userId, recordedVideosCount),
      );
  }

  private async emitPartReassignRequiredEvent(
    presentationId: number,
    userId: number,
    partId: number,
    reason: PartReassignReason,
  ) {
    const ownerSocket = await this.getOwnerSocket(presentationId);
    if (!ownerSocket) {
      return;
    }
    ownerSocket.emit('part_reassign_required', { userId, partId, reason });
  }

  private async emitPartReassignCancelledEvent(
    presentationId: number,
    userId?: number,
  ) {
    const socket = userId
      ? await this.getSocketByUserId(presentationId, userId)
      : await this.getOwnerSocket(presentationId);
    if (!socket) {
      return;
    }
    socket.emit('part_reassign_cancelled');
  }

  private emitWaitingForUserEvent(presentationId: number, userId: number) {
    const room = this.getRoomName(presentationId);
    this.server
      .to(room)
      .emit('waiting_for_user', new WaitingForUserEventDto(userId));
  }

  async emitPartReadingConfirmationRequiredEvent(
    presentationId: number,
    userId: number,
  ) {
    const socket = await this.getSocketByUserId(presentationId, userId);
    if (!socket) {
      return;
    }
    const session = await this.getActiveSession(presentationId);
    if (!session) {
      return;
    }

    if (!session.currentPresentationStartDate) {
      throw new ConflictException('Presentation is not started');
    }

    const activeReaderId = this.getActiveReaderId(session);
    if (!activeReaderId) {
      return;
    }
    if (
      userId != activeReaderId &&
      this.isUserJoined(presentationId, activeReaderId)
    ) {
      throw new ConflictException('Active reader is in the presentation');
    }

    const isWithinConfirmationTime =
      session.confirmationRequestSentTime != null &&
      Date.now() - new Date(session.confirmationRequestSentTime).getTime() <
        TIME_TO_CONFIRM_PART_READING_SECONDS * 1000;
    if (session.awaitingConfirmationUserId && isWithinConfirmationTime) {
      throw new ConflictException('Last confirmation not expired');
    }

    session.awaitingConfirmationUserId = userId;
    session.confirmationRequestSentTime = new Date();
    await this.setActiveSession(presentationId, session);

    const activePartId = session.structure.find(
      (part) => part.partId === session.currentReadingPosition.partId,
    )?.partId;
    if (!activePartId) {
      return;
    }

    socket.emit(
      'part_reading_confirmation_required',
      new PartReadingConfirmationRequiredEventDto(
        activePartId,
        TIME_TO_CONFIRM_PART_READING_SECONDS,
        userId !== activeReaderId &&
          session.currentReadingPosition.position > 0,
      ),
    );

    if (this.confirmationTimers.has(presentationId)) {
      clearTimeout(this.confirmationTimers.get(presentationId));
    }
    const timer = setTimeout(async () => {
      const session = await this.getActiveSession(presentationId);
      if (!session || !session.currentPresentationStartDate) {
        return;
      }
      await this.checkCurrentReaderAvailability(presentationId, session, true);
    }, TIME_TO_CONFIRM_PART_READING_SECONDS * 1000);

    this.confirmationTimers.set(presentationId, timer);
  }

  private async emitPartReadingConfirmationCancelledEvent(
    presentationId: number,
    userId: number,
  ) {
    const socket = await this.getSocketByUserId(presentationId, userId);
    if (!socket) {
      return;
    }

    socket.emit('part_reading_confirmation_cancelled');
  }

  private emitPartReassignedEvent(
    presentationId: number,
    userId: number,
    partId: number,
  ) {
    const room = this.getRoomName(presentationId);
    this.server.to(room).emit('part_reassigned', { userId, partId });
  }

  private async getSocketByUserId(presentationId: number, userId: number) {
    const room = this.getRoomName(presentationId);

    const socketsInRoom = await this.server.in(room).fetchSockets();

    return socketsInRoom.find(
      (socket) => (socket.data as TeleprompterSocketData).user?.id === userId,
    );
  }

  private async getOwnerSocket(presentationId: number) {
    const session = await this.getActiveSession(presentationId);
    if (!session) {
      return null;
    }
    return await this.getSocketByUserId(
      presentationId,
      session.currentOwnerUserId,
    );
  }

  private async getPartsStructure(presentationId: number) {
    const parts = await this.presentationPartRepository.find({
      where: { presentationId },
      relations: ['assignee.user'],
      order: { order: 'ASC' },
    });

    const structure: PartStructureDto[] = await Promise.all(
      parts.map(async (part) => {
        const text =
          await this.presentationPartContentService.getPresentationPartContent(
            part.presentationPartId,
            PartTarget.Text,
            part.text,
          );
        return {
          partId: part.presentationPartId,
          partTextLength: text.content.length,
          assigneeUserId: part.assignee.user.userId,
        };
      }),
    );
    return structure;
  }

  private async initializeSessionInRedis(
    presentationId: number,
    isStarted: boolean,
  ) {
    const lastSession = await this.getActiveSession(presentationId);
    const structure = await this.getPartsStructure(presentationId);

    const initialSession: ActivePresentationDto = {
      currentReadingPosition: {
        partId: structure[0]?.partId ?? 0,
        position: 0,
      },
      structure,
      userRecordedVideos: lastSession?.userRecordedVideos ?? [],
      currentPresentationStartDate: isStarted ? new Date() : undefined,
      currentOwnerUserId: (await this.getCurrentOwnerUserId(presentationId))!,
    };
    await this.setActiveSession(presentationId, initialSession);
    return initialSession;
  }

  private async getCurrentOwnerUserId(
    presentationId: number,
  ): Promise<number | undefined> {
    const joinedUserIds = Array.from(
      this.joinedUsers.get(presentationId) ?? [],
    ).map((user) => user.userId);
    const presentation = await this.presentationRepository.findOne({
      where: { presentationId },
      relations: ['owner.user'],
    });
    if (!joinedUserIds || !presentation) {
      return;
    }

    return (
      joinedUserIds.find((id) => id == presentation.owner.userId) ??
      joinedUserIds[0]
    );
  }

  @SubscribeMessage('reading_position')
  async handleReadingPosition(
    @MessageBody() data: { position: number; presentationId: number },
    @ConnectedSocket() client: TeleprompterSocket,
  ) {
    const { position, presentationId } = data;
    const userId = client.data.user?.id;

    if (!userId) {
      return;
    }

    const room = this.getRoomName(presentationId);
    const session = await this.getActiveSession(presentationId);
    if (!session) {
      return this.emitError(client, 'No active session');
    }
    if (!session.currentPresentationStartDate) {
      return this.emitError(client, 'Presentation is not started');
    }

    if (
      !Array.from(this.joinedUsers.get(presentationId) ?? []).find(
        (user) => user.userId === userId,
      )
    ) {
      return this.emitError(client, 'You are not joined');
    }

    const { structure, currentReadingPosition } = session;
    const currentPartIndex = structure.findIndex(
      (p) => p.partId === currentReadingPosition.partId,
    );
    if (currentPartIndex < 0) {
      return this.emitError(client, 'Invalid reading position');
    }

    let currentPart = structure[currentPartIndex];
    const isLastPart = currentPartIndex === structure.length - 1;

    if (userId !== currentPart.assigneeUserId) {
      return this.emitError(client, 'You cannot read this part');
    }
    if (position < 0 || position >= currentPart.partTextLength) {
      return this.emitError(client, 'Incorrect reading position');
    }

    let newPartIndex = currentPartIndex;
    let newPosition = position;
    let newPositionSendTimeoutMs = 0;

    if (!isLastPart && position === currentPart.partTextLength - 1) {
      newPartIndex++;
      currentPart = structure[newPartIndex];
      newPosition = 0;
      newPositionSendTimeoutMs = this.DELAY_BETWEEN_PARTS_MS;
    }

    session.currentReadingPosition = {
      partId: currentPart.partId,
      position: newPosition,
    };
    await this.setActiveSession(presentationId, session);
    await this.checkCurrentReaderAvailability(presentationId, session);

    setTimeout(() => {
      this.server
        .to(room)
        .emit(
          'reading_position',
          new ReadingPositionDto(currentPart.partId, newPosition),
        );
    }, newPositionSendTimeoutMs);

    if (
      newPartIndex === structure.length - 1 &&
      currentPart.partTextLength === newPosition + 1
    ) {
      const part = await this.presentationPartRepository.findOne({
        where: { presentationPartId: currentPart.partId },
      });
      if (part) {
        setTimeout(async () => {
          await this.stopPresentation(part.presentationId);
        }, this.DELAY_BETWEEN_PARTS_MS);
      }
    }
  }

  @SubscribeMessage('recorded_videos_count')
  async handleRecordedVideos(
    @MessageBody()
    data: { presentationId: number; notUploadedVideosInPresentation: number },
    @ConnectedSocket() client: TeleprompterSocket,
  ) {
    const userId = client.data.user?.id;
    if (!userId) {
      return;
    }

    if (
      !Array.from(this.joinedUsers.get(data.presentationId) ?? []).find(
        (user) => user.userId === userId,
      )
    ) {
      return this.emitError(client, 'You are not joined');
    }

    const session = await this.getActiveSession(data.presentationId);
    if (!session) {
      return this.emitError(client, 'No active session');
    }

    let userRecordedVideos = session.userRecordedVideos.find(
      (videos) => videos.userId === userId,
    );
    if (userRecordedVideos) {
      userRecordedVideos.recordedVideosCount =
        data.notUploadedVideosInPresentation;
    } else {
      userRecordedVideos = new UserRecordedVideosDto(
        userId,
        data.notUploadedVideosInPresentation,
      );
      session.userRecordedVideos.push(userRecordedVideos);
    }
    await this.setActiveSession(data.presentationId, session);
    this.emitRecordedVideosCountChange(
      data.presentationId,
      userId,
      data.notUploadedVideosInPresentation,
    );
  }

  private emitError(client: TeleprompterSocket, message: string) {
    return client.emit('error', message);
  }

  private async getActiveSession(
    presentationId: number,
  ): Promise<ActivePresentationDto | undefined> {
    const key = this.redisKeyPrefix + presentationId;
    const sessionJson = await this.redis.get(key);
    return sessionJson ? JSON.parse(sessionJson) : undefined;
  }

  private async setActiveSession(
    presentationId: number,
    session: ActivePresentationDto | null,
  ) {
    const key = this.redisKeyPrefix + presentationId;
    if (!session) {
      await this.redis.del(key);
      return;
    }
    await this.redis.set(key, JSON.stringify(session));
  }

  async getActivePresentation(
    presentationId: number,
  ): Promise<ActivePresentationWithUsersDto | null> {
    const activePresentation = await this.getActiveSession(presentationId);
    const joinedUsers = Array.from(this.joinedUsers.get(presentationId) ?? []);
    if (!activePresentation) {
      return null;
    }
    return {
      ...activePresentation,
      joinedUsers,
    };
  }

  async setTeleprompterState(
    presentationId: number,
    started: boolean,
  ): Promise<void> {
    if (started) {
      const session = await this.initializeSessionInRedis(presentationId, true);
      await this.checkCurrentReaderAvailability(presentationId, session);
      return;
    }
    const session = await this.getActiveSession(presentationId);
    if (!session) return;

    if (!this.joinedUsers.get(presentationId)) {
      await this.setActiveSession(presentationId, null);
      return;
    }

    const previousPartsMap = new Map(
      session.structure.map((part) => [part.partId, part.assigneeUserId]),
    );

    session.currentPresentationStartDate = undefined;
    session.currentReadingPosition = {
      partId: session.structure[0]?.partId ?? 0,
      position: 0,
    };

    session.structure = await this.getPartsStructure(presentationId);

    for (const part of session.structure) {
      const prevAssignee = previousPartsMap.get(part.partId);
      if (prevAssignee !== part.assigneeUserId) {
        this.emitPartReassignedEvent(
          presentationId,
          part.assigneeUserId,
          part.partId,
        );
      }
    }

    await this.setActiveSession(presentationId, session);
  }

  async changeJoinedUserRecordingMode(
    userId: number,
    presentationId: number,
    isActive: boolean,
  ): Promise<void> {
    const joinedUsers = this.joinedUsers.get(presentationId);
    if (!joinedUsers) {
      throw new NotFoundException('User has not joined');
    }

    let targetUser: JoinedUserDto | undefined;
    for (const userDto of joinedUsers) {
      if (userDto.userId === userId) {
        targetUser = userDto;
        break;
      }
    }
    if (!targetUser) {
      throw new NotFoundException('User has not joined');
    }

    const activeSession = await this.getActiveSession(presentationId);
    if (!activeSession) {
      throw new NotFoundException('Session has not been started');
    }

    targetUser.isRecordingModeActive = isActive;
    this.emitRecordingModeChange(presentationId, userId, isActive);
  }

  private async checkCurrentReaderAvailability(
    presentationId: number,
    session: ActivePresentationDto,
    isTimeout: boolean = false,
  ) {
    const currentReaderId = this.getActiveReaderId(session);
    const hasPresentationStarted = Boolean(
      session.currentPresentationStartDate,
    );
    const hasReader = currentReaderId != null;
    const readerAlreadyJoined =
      hasReader && this.isUserJoined(presentationId, currentReaderId);
    const awaitingId = session.awaitingConfirmationUserId;
    const requestedAt =
      new Date(session.confirmationRequestSentTime as any).getTime() || 0;
    const isWithinConfirmationTime =
      awaitingId != null &&
      Date.now() - requestedAt < TIME_TO_CONFIRM_PART_READING_SECONDS * 1000;
    const awaitingUserJoined =
      isWithinConfirmationTime && this.isUserJoined(presentationId, awaitingId);

    if (
      !hasPresentationStarted ||
      !hasReader ||
      readerAlreadyJoined ||
      awaitingUserJoined
    ) {
      return;
    }

    session.awaitingConfirmationUserId = undefined;
    session.confirmationRequestSentTime = undefined;
    session.missingUserId = currentReaderId;
    await this.setActiveSession(presentationId, session);

    await this.emitPartReassignRequiredEvent(
      presentationId,
      session.awaitingConfirmationUserId ?? currentReaderId,
      session.currentReadingPosition.partId,
      isTimeout
        ? PartReassignReason.AssigneeNotResponding
        : PartReassignReason.MissingAssignee,
    );
    this.emitWaitingForUserEvent(presentationId, currentReaderId);

    const { partName, presentationName } =
      await this.getPartAndPresentationNames(
        session.currentReadingPosition.partId,
      );

    const notificationBody = this.formatNotificationText(
      WAITING_FOR_USER_NOTIFICATION_BODY,
      partName,
      presentationName,
    );
    await this.sendPushNotification(
      currentReaderId,
      WAITING_FOR_USER_NOTIFICATION_TITLE,
      notificationBody,
    );
  }

  private isUserJoined(presentationId: number, userId: number): boolean {
    const joinedUsers = Array.from(this.joinedUsers.get(presentationId) ?? []);
    return joinedUsers.find((user) => user.userId === userId) !== undefined;
  }

  private getActiveReaderId(
    session: ActivePresentationDto,
  ): number | undefined {
    return session.structure.find(
      (part) => part.partId == session.currentReadingPosition.partId,
    )?.assigneeUserId;
  }

  async changeCurrentPartReader(
    presentationId: number,
    readerId: number,
    isFromStartPosition: boolean,
  ): Promise<void> {
    const session = await this.getActiveSession(presentationId);
    if (!session) {
      return;
    }

    const currentPart = session.structure.find(
      (part) => part.partId == session.currentReadingPosition.partId,
    );
    if (!currentPart) {
      return;
    }
    const oldReaderId = currentPart.assigneeUserId;
    currentPart.assigneeUserId = readerId;

    if (isFromStartPosition) {
      session.currentReadingPosition.position = 0;
      const room = this.getRoomName(presentationId);
      this.server
        .to(room)
        .emit(
          'reading_position',
          new ReadingPositionDto(currentPart.partId, 0),
        );
    }

    session.missingUserId = undefined;

    await this.setActiveSession(presentationId, session);
    this.emitPartReassignedEvent(presentationId, readerId, currentPart.partId);

    const { partName, presentationName } =
      await this.getPartAndPresentationNames(
        session.currentReadingPosition.partId,
      );

    const notificationBody = this.formatNotificationText(
      YOUR_PART_REASSIGNED_NOTIFICATION_BODY,
      partName,
      presentationName,
    );

    await this.sendPushNotification(
      oldReaderId,
      YOUR_PART_REASSIGNED_NOTIFICATION_TITLE,
      notificationBody,
    );
  }

  private async sendPushNotification(
    userId: number,
    title: string,
    body: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { userId },
      select: ['fcmToken'],
    });
    if (!user?.fcmToken) {
      return;
    }
    await this.notificationsService.sendPushNotification(
      user.fcmToken,
      title,
      body,
    );
  }

  private formatNotificationText(
    template: string,
    partName: string,
    presentationName: string,
  ) {
    return template
      .replace(NOTIFICATION_PART_NAME_PLACEHOLDER, partName)
      .replace(NOTIFICATION_PRESENTATION_NAME_PLACEHOLDER, presentationName);
  }

  private async getPartAndPresentationNames(
    partId: number,
  ): Promise<{ partName: string; presentationName: string }> {
    const part = await this.presentationPartRepository
      .createQueryBuilder('part')
      .leftJoinAndSelect('part.presentation', 'presentation')
      .select(['part.name', 'presentation.name'])
      .where('part.presentationPartId = :id', { id: partId })
      .getOne();

    return {
      partName: part?.name ?? '',
      presentationName: part?.presentation.name ?? '',
    };
  }

  async updatePartAssignee(
    presentationId: number,
    partId: number,
    assigneeUserId: number,
  ) {
    const session = await this.getActiveSession(presentationId);
    if (!session) return;

    const prev = session.structure.find((p) => p.partId === partId);
    if (prev && prev.assigneeUserId !== assigneeUserId) {
      this.emitPartReassignedEvent(presentationId, assigneeUserId, partId);
    }

    session.structure = session.structure.map((part) => {
      if (part.partId === partId) {
        return { ...part, assigneeUserId };
      }
      return part;
    });
    await this.setActiveSession(presentationId, session);
  }
}
