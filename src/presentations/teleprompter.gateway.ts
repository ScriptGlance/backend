import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BaseGateway } from '../common/base/base.gateway';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import {PresenceDto} from "./dto/EditingPresenceDto";
import {PresenceEventType} from "../common/enum/PresenceEventType";
import {PartStructureDto} from "./dto/PartStructureDto";
import {ReadingPositionDto} from "./dto/ReadingPositionDto";
import {InjectRepository} from "@nestjs/typeorm";
import {PresentationPartEntity} from "../common/entities/PresentationPartEntity";
import {Repository} from "typeorm";
import {ActivePresentationDto} from "./dto/ActivePresentationDto";
import {ActivePresentationWithUsersDto} from "./dto/ActivePresentationWithUsersDto";

type TeleprompterSocket = Socket & { data: { user?: { id: number } } };

@WebSocketGateway({ cors: true })
export class TeleprompterGateway extends BaseGateway implements OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly participants = new Map<number, Set<number>>();
    private readonly redisKeyPrefix = 'teleprompter:session:';

    constructor(
        jwtService: JwtService,
        configService: ConfigService,
        @InjectRedis()
        private readonly redis: Redis,
        @InjectRepository(PresentationPartEntity)
        private readonly presentationPartRepository: Repository<PresentationPartEntity>,
    ) {
        super(jwtService, configService);
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
        const room = this.getRoomName(data.presentationId);
        await client.join(room);
        console.log('subscribe_teleprompter: ', data.presentationId, ' ', userId, ' ', room)
        if (!this.participants.has(data.presentationId)) {
            console.log('initialize session')
            this.participants.set(data.presentationId, new Set());
            await this.initializeSessionInRedis(data.presentationId);
        }
        this.participants.get(data.presentationId)!.add(userId);
        client.broadcast
            .to(room)
            .emit(
                'teleprompter_presence',
                new PresenceDto(userId, PresenceEventType.UserJoined),
            );
    }

    handleDisconnect(client: TeleprompterSocket) {
        const userId = client.data.user?.id;
        if (!userId) return;
        for (const [presentationId, users] of this.participants.entries()) {
            if (users.has(userId)) {
                users.delete(userId);
                const room = this.getRoomName(presentationId);
                this.server
                    .to(room)
                    .emit(
                        'teleprompter_presence',
                        new PresenceDto(userId, PresenceEventType.UserLeft),
                    );
            }
        }
    }

    private getRoomName(presentationId: number): string {
        return `presentation/${presentationId}/teleprompter`;
    }

    private async initializeSessionInRedis(presentationId: number) {
        const key = this.redisKeyPrefix + presentationId;
        const exists = await this.redis.exists(key);
        if (exists) {
            return;
        }
        const parts = await this.presentationPartRepository.find({
            where: {presentationId}
        })
        const structure: PartStructureDto[] = parts.map(item => ({
            partId: item.presentationPartId,
            assigneeUserId: item.assignee.user.userId,
        }));
        const initial: ActivePresentationDto = {
            currentReadingPosition: {
                partId: structure[0]?.partId ?? 0,
                position: 0
            },
            structure,
        };
        await this.redis.set(key, JSON.stringify(initial));
    }

    @SubscribeMessage('reading_position')
    async handleReadingPosition(
        @MessageBody() dto: ReadingPositionDto,
        @ConnectedSocket() client: TeleprompterSocket,
    ) {
        const room = this.getRoomName(dto.presentationId);
        const key = this.redisKeyPrefix + dto.presentationId;
        const sessionJson = await this.redis.get(key);
        if (!sessionJson) {
            client.emit('error', 'No active session');
            return;
        }
        const session = JSON.parse(sessionJson);
        session.current_reading_position = { part_id: dto.partId, position: dto.position };
        await this.redis.set(key, JSON.stringify(session));
        this.server.to(room).emit('reading_position', dto);
    }


    async getActivePresentation(
        presentationId: number,
    ): Promise<ActivePresentationWithUsersDto | null> {
        const key = this.redisKeyPrefix + presentationId;
        const sessionJson = await this.redis.get(key);
        console.log('session data for ', presentationId, ' ', sessionJson, ' ', key, ' ', this.participants.get(presentationId) ?? [])
        if (!sessionJson) {
            return null;
        }
        const activePresentation = JSON.parse(sessionJson) as ActivePresentationDto;
        const joinedUserIds = Array.from(this.participants.get(presentationId) ?? []);
        return {
            activePresentation,
            joinedUserIds,
        };
    }
}
