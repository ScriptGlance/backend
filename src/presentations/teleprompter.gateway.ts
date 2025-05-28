import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
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
import { TIME_TO_CONFIRM_PART_READING_SECONDS } from '../common/Constants';
import { BasePresentationGateway } from '../common/base/basePresentation.gateway';
import { PresentationPartContentService } from './presentation-part-content.service';
import { PartTarget } from '../common/enum/PartTarget';
import { retry } from 'rxjs';

type TeleprompterSocketData = { user?: { id: number } };
type TeleprompterSocket = Socket & { data: TeleprompterSocketData };

@WebSocketGateway({ cors: true })
export class TeleprompterGateway
  extends BasePresentationGateway
  implements OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server: Server;

  private readonly joinedUsers = new Map<number, Set<JoinedUserDto>>();
  private readonly redisKeyPrefix = 'teleprompter:session:';
  private readonly mutex = new Mutex();

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
    private readonly presentationsGateway: PresentationsGateway,
    private readonly presentationPartContentService: PresentationPartContentService,
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

        await this.checkOwnerChange(data.presentationId);
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

  private async checkOwnerChange(presentationId: number) {
    const session = await this.getActiveSession(presentationId);
    const currentOwnerUserId = await this.getCurrentOwnerUserId(presentationId);
    if (
      currentOwnerUserId &&
      session &&
      session.currentOwnerUserId != currentOwnerUserId
    ) {
      session.currentOwnerUserId = currentOwnerUserId;
      this.emitOwnerChangeEvent(presentationId, session.currentOwnerUserId);
      await this.setActiveSession(presentationId, session);
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
          if (users.size === 0) {
            await this.stopPresentation(presentationId);
            this.joinedUsers.delete(presentationId);
          }
          this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.JoinedUsersChanged,
          );

          await this.checkOwnerChange(presentationId);

          const session = await this.getActiveSession(presentationId);
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

  private async emitRecordedVideosCountChange(
    presentationId: number,
    userId: number,
    recordedVideosCount: number,
  ) {
    const ownerSocket = await this.getOwnerSocket(presentationId);
    if (!ownerSocket) {
      return;
    }
    ownerSocket.emit(
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

  private async emitPartReassignCancelledEvent(presentationId: number) {
    const ownerSocket = await this.getOwnerSocket(presentationId);
    if (!ownerSocket) {
      return;
    }
    ownerSocket.emit('part_reassign_cancelled');
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

    setTimeout(async () => {
      const session = await this.getActiveSession(presentationId);
      if (!session || !session.currentPresentationStartDate) {
        return;
      }
      await this.checkCurrentReaderAvailability(presentationId, session, true);
    }, TIME_TO_CONFIRM_PART_READING_SECONDS * 1000);
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

  private async initializeSessionInRedis(
    presentationId: number,
    isStarted: boolean,
  ) {
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

    const lastSession = await this.getActiveSession(presentationId);

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

    if (!isLastPart && position === currentPart.partTextLength - 1) {
      newPartIndex++;
      currentPart = structure[newPartIndex];
      newPosition = 0;
    }

    session.currentReadingPosition = {
      partId: currentPart.partId,
      position: newPosition,
    };
    await this.setActiveSession(presentationId, session);
    await this.checkCurrentReaderAvailability(presentationId, session);

    this.server
      .to(room)
      .emit(
        'reading_position',
        new ReadingPositionDto(currentPart.partId, newPosition),
      );

    if (
      newPartIndex === structure.length - 1 &&
      currentPart.partTextLength === newPosition - 1
    ) {
      const part = await this.presentationPartRepository.findOne({
        where: { presentationPartId: currentPart.partId },
      });
      if (part) {
        await this.stopPresentation(part.presentationId);
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
    await this.emitRecordedVideosCountChange(
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
    if (!session) {
      return;
    }

    if (!this.joinedUsers.get(presentationId)) {
      await this.setActiveSession(presentationId, null);
    }

    session.currentPresentationStartDate = undefined;
    session.currentReadingPosition = {
      partId: session.structure[0]?.partId ?? 0,
      position: 0,
    };
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

    if (activeSession.currentPresentationStartDate) {
      const { partId: currentPartId } = activeSession.currentReadingPosition;
      const currentPart = activeSession.structure.find(
        (part) => part.partId === currentPartId,
      );
      if (currentPart?.assigneeUserId === userId) {
        throw new ConflictException(
          'You cannot change recording mode when your part is active',
        );
      }
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
      awaitingId ?? currentReaderId,
      session.currentReadingPosition.partId,
      isTimeout
        ? PartReassignReason.AssigneeNotResponding
        : PartReassignReason.MissingAssignee,
    );
    this.emitWaitingForUserEvent(presentationId, currentReaderId);
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

    await this.setActiveSession(presentationId, session);
  }
}
