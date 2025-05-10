import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {BaseGateway} from '../common/base/base.gateway';
import {InjectRedis} from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import {PresenceDto} from "./dto/EditingPresenceDto";
import {PresenceEventType} from "../common/enum/PresenceEventType";
import {PartStructureDto} from "./dto/PartStructureDto";
import {ReadingPositionDto} from "./dto/ReadingPositionDto";
import {InjectRepository} from "@nestjs/typeorm";
import {PresentationPartEntity} from "../common/entities/PresentationPartEntity";
import {IsNull, Repository} from "typeorm";
import {ActivePresentationDto} from "./dto/ActivePresentationDto";
import {ActivePresentationWithUsersDto} from "./dto/ActivePresentationWithUsersDto";
import {Mutex} from "async-mutex";
import {PresentationStartEntity} from "../common/entities/PresentationStartEntity";
import {PresentationEventType} from "../common/enum/PresentationEventType";
import {PresentationsGateway} from "./presentations.gateway";
import {ConflictException, NotFoundException, OnModuleInit} from "@nestjs/common";
import {PresentationEntity} from "../common/entities/PresentationEntity";
import {OwnerChangeEventDto} from "./dto/OwnerChangeEventDto";
import {JoinedUserDto} from "./dto/JoinedUserDto";
import {RecordingModeChangeDto} from "./dto/RecordingModeChangeDto";
import {UserRecordedVideosDto} from "./dto/UserRecordedVideosDto";
import {RecordedVideosCountChangeEventDto} from "./dto/RecordedVideosCountChangeEventDto";

type TeleprompterSocketData = { user?: { id: number } };
type TeleprompterSocket = Socket & { data: TeleprompterSocketData };

@WebSocketGateway({cors: true})
export class TeleprompterGateway extends BaseGateway implements OnGatewayDisconnect, OnModuleInit {
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
        private readonly presentationsGateway: PresentationsGateway
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
        const userId = client.data.user?.id;
        if (!userId) {
            client.emit('error', 'User not authenticated');
            return;
        }
        const presentation = await this.getPresentationWithAccessControl(data.presentationId, userId);
        if (!presentation) {
            client.emit('error', 'Access denied to presentation');
        }

        const room = this.getRoomName(data.presentationId);
        await client.join(room);
        if (!this.joinedUsers.has(data.presentationId)) {
            const users = new Set<JoinedUserDto>();
            users.add(new JoinedUserDto(userId));
            this.joinedUsers.set(data.presentationId, users);
            const session = await this.initializeSessionInRedis(data.presentationId, false);
            this.emitOwnerChangeEvent(data.presentationId, session!.currentOwnerUserId);
        } else {
            this.joinedUsers.get(data.presentationId)!.add(new JoinedUserDto(userId));
            await this.checkOwnerChange(data.presentationId);
        }
        client.broadcast
            .to(room)
            .emit(
                'teleprompter_presence',
                new PresenceDto(userId, PresenceEventType.UserJoined),
            );
        this.presentationsGateway.emitPresentationEvent(data.presentationId, PresentationEventType.JoinedUsersChanged)
    }

    private async checkOwnerChange(presentationId: number) {
        const session = (await this.getActiveSession(presentationId))!;
        const currentOwnerUserId = await this.getCurrentOwnerUserId(presentationId);
        if (currentOwnerUserId && session.currentOwnerUserId != currentOwnerUserId) {
            session.currentOwnerUserId = currentOwnerUserId;
            this.emitOwnerChangeEvent(presentationId, session!.currentOwnerUserId);
            await this.setActiveSession(presentationId, session);
        }
    }

    async handleDisconnect(client: TeleprompterSocket) {
        const userId = client.data.user?.id;
        if (!userId) return;

        await this.mutex.runExclusive(async () => {
            for (const [presentationId, users] of this.joinedUsers.entries()) {
                const user = Array.from(users ?? []).find(user => user.userId === userId);
                if (user) {
                    users.delete(user);
                    const room = this.getRoomName(presentationId);
                    this.server.to(room).emit(
                        'teleprompter_presence',
                        new PresenceDto(userId, PresenceEventType.UserLeft),
                    );
                    if (users.size === 0) {
                        await this.stopPresentation(presentationId);
                        this.joinedUsers.delete(presentationId);
                    }
                    this.presentationsGateway.emitPresentationEvent(presentationId, PresentationEventType.JoinedUsersChanged);

                    await this.checkOwnerChange(presentationId);
                }
            }
        });
    }

    private async stopPresentation(presentationId: number) {
        const activeSession = await this.presentationStartRepository.findOne({
            where: {presentation: {presentationId}, endDate: IsNull()}
        });
        if (!activeSession) {
            return
        }
        activeSession.endDate = new Date();
        await this.presentationStartRepository.save(activeSession);
        this.presentationsGateway.emitPresentationEvent(
            presentationId,
            PresentationEventType.PresentationStopped
        );
        await this.setTeleprompterState(presentationId, false)
    }

    private getRoomName(presentationId: number): string {
        return `presentation/${presentationId}/teleprompter`;
    }

    private emitOwnerChangeEvent(presentationId: number, newOwnerUserId: number) {
        const room = this.getRoomName(presentationId);
        this.server.to(room).emit("owner_changed", new OwnerChangeEventDto(newOwnerUserId));
    }

    private emitRecordingModeChange(presentationId: number, userId: number, isActive: boolean) {
        const room = this.getRoomName(presentationId);
        this.server.to(room).emit("recording_mode_changed", new RecordingModeChangeDto(userId, isActive));
    }

    private async emitRecordedVideosCountChange(
        presentationId: number,
        userId: number,
        recordedVideosCount: number
    ) {
        const activeSession = await this.getActiveSession(presentationId);
        if (!activeSession) return;

        const ownerUserId = activeSession.currentOwnerUserId;
        const room = this.getRoomName(presentationId);

        const socketsInRoom = await this.server.in(room).fetchSockets();

        const ownerSocket = socketsInRoom.find(
            socket => (socket.data as TeleprompterSocketData).user?.id === ownerUserId
        );

        if (ownerSocket) {
            ownerSocket.emit(
                'recorded_videos_count_change',
                new RecordedVideosCountChangeEventDto(userId, recordedVideosCount)
            );
        }
    }



    private async initializeSessionInRedis(presentationId: number, isStarted: boolean) {
        const parts = await this.presentationPartRepository.find({
            where: {presentationId},
            relations: ['assignee.user'],
            order: {order: 'ASC'},
        })
        const structure: PartStructureDto[] = parts.map(item => ({
            partId: item.presentationPartId,
            partTextLength: item.text.length,
            assigneeUserId: item.assignee.user.userId,
        }));

        const lastSession = await this.getActiveSession(presentationId);

        const initialSession: ActivePresentationDto = {
            currentReadingPosition: {
                partId: structure[0]?.partId ?? 0,
                position: 0
            },
            structure,
            userRecordedVideos: lastSession?.userRecordedVideos ?? [],
            currentPresentationStartDate: isStarted ? new Date() : undefined,
            currentOwnerUserId: (await this.getCurrentOwnerUserId(presentationId))!,
        };
        await this.setActiveSession(presentationId, initialSession);
        return initialSession;
    }

    private async getCurrentOwnerUserId(presentationId: number): Promise<number | undefined> {
        const joinedUserIds = Array.from(this.joinedUsers.get(presentationId) ?? []).map(user => user.userId);
        const presentation = await this.presentationRepository.findOne({
            where: {presentationId},
            relations: ['owner.user'],
        });
        if (!joinedUserIds || !presentation) {
            return;
        }

        return joinedUserIds.find(id => id == presentation.owner.userId) ?? joinedUserIds[0];
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

        const { structure, currentReadingPosition } = session;
        const currentPartIndex = structure.findIndex(p => p.partId === currentReadingPosition.partId);
        if (currentPartIndex < 0) {
            return this.emitError(client, 'Invalid reading position');
        }

        let currentPart = structure[currentPartIndex];
        const isLastPart = currentPartIndex === structure.length - 1;

        if (userId !== currentPart.assigneeUserId) {
            return this.emitError(client, 'You cannot read this part');
        }
        if (position < 0 || position > currentPart.partTextLength) {
            return this.emitError(client, 'Incorrect reading position');
        }

        let newPartIndex = currentPartIndex;
        let newPosition = position;

        if (!isLastPart && position === currentPart.partTextLength) {
            newPartIndex++;
            currentPart = structure[newPartIndex];
            newPosition = 0;
        }

        session.currentReadingPosition = { partId: currentPart.partId, position: newPosition };
        await this.setActiveSession(presentationId, session);

        client.broadcast
            .to(room)
            .emit('reading_position', new ReadingPositionDto(currentPart.partId, newPosition));

        if (newPartIndex === structure.length - 1
            && currentPart.partTextLength === newPosition) {
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
        @MessageBody() data: { presentationId: number, notUploadedVideosInPresentation: number },
        @ConnectedSocket() client: TeleprompterSocket,
    ) {
        const userId = client.data.user?.id;
        if (!userId) {
            return;
        }

        if (!Array.from(this.joinedUsers.get(data.presentationId) ?? []).find(user => user.userId === userId)) {
            return this.emitError(client, 'You are not joined');
        }

        const session = await this.getActiveSession(data.presentationId);
        if (!session) {
            return this.emitError(client, 'No active session');
        }

        let userRecordedVideos = session.userRecordedVideos.find(videos => videos.userId === userId);
        if (userRecordedVideos) {
            userRecordedVideos.recordedVideosCount = data.notUploadedVideosInPresentation;
        } else {
            userRecordedVideos = new UserRecordedVideosDto(userId, data.notUploadedVideosInPresentation);
            session.userRecordedVideos.push(userRecordedVideos);
        }
        await this.setActiveSession(data.presentationId, session);
        await this.emitRecordedVideosCountChange(data.presentationId, userId, data.notUploadedVideosInPresentation);
    }


    private emitError(client: TeleprompterSocket, message: string) {
        return client.emit('error', message);
    }

    private async getActiveSession(presentationId: number): Promise<ActivePresentationDto | undefined> {
        const key = this.redisKeyPrefix + presentationId;
        const sessionJson = await this.redis.get(key);
        return sessionJson ? JSON.parse(sessionJson) : undefined;
    }

    private async setActiveSession(presentationId: number, session: ActivePresentationDto | null) {
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
        if(!activePresentation) {
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
            await this.initializeSessionInRedis(presentationId, true);
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
        await this.setActiveSession(presentationId, session);
    }

    async changeJoinedUserRecordingMode(
        userId: number,
        presentationId: number,
        isActive: boolean
    ): Promise<void> {
        const joinedUsers = this.joinedUsers.get(presentationId);
        if (!joinedUsers) {
            throw new NotFoundException("User has not joined");
        }

        let targetUser: JoinedUserDto | undefined;
        for (const userDto of joinedUsers) {
            if (userDto.userId === userId) {
                targetUser = userDto;
                break;
            }
        }
        if (!targetUser) {
            throw new NotFoundException("User has not joined");
        }

        const activeSession = await this.getActiveSession(presentationId);
        if (!activeSession) {
            throw new NotFoundException("Session has not been started");
        }

        if (activeSession.currentPresentationStartDate) {
            const { partId: currentPartId } = activeSession.currentReadingPosition;
            const currentPart = activeSession.structure.find(
                part => part.partId === currentPartId
            );
            if (currentPart?.assigneeUserId === userId) {
                throw new ConflictException(
                    "You cannot change recording mode when your part is active"
                );
            }
        }

        targetUser.isRecordingModeActive = isActive;
        this.emitRecordingModeChange(presentationId, userId, isActive)
    }
}
