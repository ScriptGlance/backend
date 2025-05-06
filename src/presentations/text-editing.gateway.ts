import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer
} from "@nestjs/websockets";
import {Server, Socket} from "socket.io";
import Redis from "ioredis";
import {InjectRedis} from "@nestjs-modules/ioredis";
import {EditingPresenceDto} from "./dto/EditingPresenceDto";
import {PresenceEventType} from "../common/enum/PresenceEventType";
import {UnauthorizedException} from "@nestjs/common";
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import {InjectRepository} from "@nestjs/typeorm";
import {PresentationEntity} from "../common/entities/PresentationEntity";
import {Repository} from "typeorm";
import {CursorPositionDto} from "./dto/CursorPositionDto";
import {PartTarget} from "../common/enum/PartTarget";

@WebSocketGateway({cors: true})
export class TextEditingGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private readonly cursorPositions = new Map<string, CursorPositionDto>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @InjectRepository(PresentationEntity)
        private readonly presentationRepository: Repository<PresentationEntity>,
        @InjectRedis() private redis: Redis
    ) {
    }

    @SubscribeMessage('text_operations')
    async onTextOperation(@MessageBody() data, @ConnectedSocket() client: Socket) {
        const {presentationId, partId, operations, userId, baseVersion} = data;
        const redisKey = `editing:part:${partId}`;

        const existing = await this.redis.get(redisKey);
        const content = existing ? JSON.parse(existing).text : await this.loadFromDb(partId);

        const transformed = this.applyOperations(content, operations);
        const newData = {text: transformed, version: baseVersion + 1};

        await this.redis.set(redisKey, JSON.stringify(newData), 'EX', 60);

        this.server.to(`presentation/${presentationId}/part/${partId}`).emit('text_operations', {
            ...data,
            operations,
            appliedVersion: newData.version
        });
    }

    @SubscribeMessage('subscribe_text')
    async onSubscribeText(@MessageBody() {presentationId}, @ConnectedSocket() client: Socket) {
        const userId = client.data.user.id as number;
        const presentation = await this.presentationRepository
            .createQueryBuilder('presentation')
            .leftJoinAndSelect('presentation.owner', 'owner')
            .leftJoinAndSelect('owner.user', 'ownerUser')
            .leftJoinAndSelect('presentation.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .where('presentation.presentationId = :id', {id: presentationId})
            .getOne();

        if (
            !presentation ||
            !this.userHasAccessToPresentation(presentation, userId)
        ) {
            client.emit('error', 'Access denied to presentation');
            return;
        }
        const room = this.getRoom(presentationId)
        client.join(room);
        if (!client.data.joinedRooms) {
            client.data.joinedRooms = new Set();
        }
        client.data.joinedRooms.add(room);
        this.cursorPositions.set(`${userId}:${presentation.presentationId}`, new CursorPositionDto(userId));
        client.broadcast.to(room).emit('editing_presence', new EditingPresenceDto(client.data.user.id, PresenceEventType.UserJoined));
    }

    handleDisconnect(client: Socket) {
        const rooms = client.data.joinedRooms ?? [];
        const userId = client.data.user?.id;
        for (const room of rooms) {
            this.server.to(room).emit(
                'editing_presence',
                new EditingPresenceDto(userId, PresenceEventType.UserLeft)
            );
        }
        if (userId) {
            for (const key of this.cursorPositions.keys()) {
                if (key.startsWith(`${userId}:`)) {
                    this.cursorPositions.delete(key);
                }
            }
        }
    }

    @SubscribeMessage('cursor_position_change')
    async onCursorPositionChange(@MessageBody() data: {
        part_id: number,
        cursor_position: number,
        selection_anchor_position?: number,
        target: PartTarget,
    }, @ConnectedSocket() client: Socket) {
        const userId = client.data.user.id as number;
        const presentation = await this.presentationRepository
            .createQueryBuilder('presentation')
            .leftJoinAndSelect('presentation.owner', 'owner')
            .leftJoinAndSelect('owner.user', 'ownerUser')
            .leftJoinAndSelect('presentation.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .leftJoinAndSelect('presentation.parts', 'part')
            .where('part.presentationPartId = :id', {id: data.part_id})
            .getOne();
        if (
            !presentation ||
            !this.userHasAccessToPresentation(presentation, userId)
        ) {
            client.emit('error', 'Access denied to presentation');
            return;
        }
        const room = this.getRoom(presentation.presentationId);
        if (!client.rooms.has(room)) {
            client.emit('error', 'Not subscribed to text editing');
            return;
        }
        const dto = new CursorPositionDto(userId, data.part_id, data.cursor_position, data.target, data.selection_anchor_position);
        this.cursorPositions.set(`${userId}:${presentation.presentationId}`, dto);
        client.broadcast.to(room).emit('cursor_position_change', dto);
    }

    applyOperations(text: string, operations: any[]): string {
        return text;
    }

    async loadFromDb(partId: number): Promise<string> {
        return '...';
    }

    async handleConnection(client: Socket) { //TODO refactor
        try {
            const token = client.handshake.auth?.token as string | undefined;
            if (!token) throw new UnauthorizedException();

            const payload: {
                sub: { id: number };
                email: string;
                role: string;
            } = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>('JWT_SECRET'),
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            client.data.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
            };
        } catch (err) {
            client.disconnect();
        }
    }

    private userHasAccessToPresentation(
        presentation: PresentationEntity,
        userId: number,
    ): boolean {
        if (presentation.owner?.user?.userId === userId) {
            return true;
        }

        return presentation.participants?.some(
            (participant) => participant.user?.userId === userId,
        );
    }

    private getRoom(presentationId: number): string {
        return `presentation/${presentationId}/text-editing`
    }

    public getCursorPositionsForPresentation(presentationId: number): CursorPositionDto[] {
        const result: CursorPositionDto[] = [];
        for (const [key, value] of this.cursorPositions.entries()) {
            const [, keyPresentationId] = key.split(':');
            if (Number(keyPresentationId) === presentationId) {
                result.push(value);
            }
        }
        return result;
    }
}
