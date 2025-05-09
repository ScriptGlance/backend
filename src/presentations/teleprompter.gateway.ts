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
import {OnModuleInit} from "@nestjs/common";
import {PresentationEntity} from "../common/entities/PresentationEntity";
import {OwnerChangeEventDto} from "./dto/OwnerChangeEventDto";

type TeleprompterSocket = Socket & { data: { user?: { id: number } } };

@WebSocketGateway({cors: true})
export class TeleprompterGateway extends BaseGateway implements OnGatewayDisconnect, OnModuleInit {
    @WebSocketServer()
    server: Server;

    private readonly joinedUsers = new Map<number, Set<number>>();
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
            const users = new Set<number>();
            users.add(userId);
            this.joinedUsers.set(data.presentationId, users);
            const session = await this.initializeSessionInRedis(data.presentationId, false);
            this.emitOwnerChangeEvent(data.presentationId, session!.currentOwnerUserId);
        } else {
            this.joinedUsers.get(data.presentationId)!.add(userId);
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
                if (users.has(userId)) {
                    users.delete(userId);

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

        const initialSession: ActivePresentationDto = {
            currentReadingPosition: {
                partId: structure[0]?.partId ?? 0,
                position: 0
            },
            structure,
            currentPresentationStartDate: isStarted ? new Date() : undefined,
            currentOwnerUserId: (await this.getCurrentOwnerUserId(presentationId))!,
        };
        await this.setActiveSession(presentationId, initialSession);
        return initialSession;
    }

    private async getCurrentOwnerUserId(presentationId: number): Promise<number | undefined> {
        const joinedUserIds = Array.from(this.joinedUsers.get(presentationId) ?? []);
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
        @MessageBody() data: { position: number, presentationId: number },
        @ConnectedSocket() client: TeleprompterSocket,
    ) {
        const userId = client.data.user?.id;
        if (!userId) return;

        const room = this.getRoomName(data.presentationId);
        const session = await this.getActiveSession(data.presentationId);
        if (!session) {
            client.emit('error', 'No active session');
            return;
        }

        if (!session.currentPresentationStartDate) {
            client.emit('error', 'Presentation is not started');
            return;
        }

        let currentPart = session.structure.find(part => part.partId == session.currentReadingPosition.partId)!;
        let currentPartIndex = session.structure.indexOf(currentPart);
        let isLastPart = currentPartIndex == session.structure.length - 1;
        if (!isLastPart && session.currentReadingPosition.position == currentPart.partTextLength) {
            currentPart = session.structure[++currentPartIndex];
            isLastPart = currentPartIndex == session.structure.length - 1;
        }

        if (userId != currentPart.assigneeUserId) {
            client.emit('error', 'You cannot read this part');
            return;
        }

        if (data.position < 0 || data.position > currentPart.partTextLength) {
            client.emit('error', 'Incorrect reading position');
            return;
        }

        session.currentReadingPosition = {
            partId: currentPart.partId,
            position: data.position
        };

        await this.setActiveSession(data.presentationId, session);
        client.broadcast.to(room).emit('reading_position', new ReadingPositionDto(currentPart.partId, data.position));

        if (isLastPart && currentPart.partTextLength == session.currentReadingPosition.position) {
            const part = (await this.presentationPartRepository.findOne({
                where: {presentationPartId: currentPart.partId}
            }))!;
            await this.stopPresentation(part.presentationId)
        }
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
        const joinedUserIds = Array.from(this.joinedUsers.get(presentationId) ?? []);
        return {
            activePresentation,
            joinedUserIds,
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
}
