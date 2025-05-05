import {
    SubscribeMessage,
    WebSocketGateway,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket, Server } from 'socket.io';
import {
    UnauthorizedException,
    Injectable,
} from '@nestjs/common';
import {Repository} from "typeorm";
import {PresentationEntity} from "../common/entities/PresentationEntity";
import {InjectRepository} from "@nestjs/typeorm";
import {PresentationEventDto} from "./dto/PresentationEventDto";
import {PresentationEventType} from "../common/enum/PresentationEventType";

@WebSocketGateway({ cors: true })
@Injectable()
export class PresentationGateway
    implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
    private server: Server;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @InjectRepository(PresentationEntity)
        private readonly presentationRepository: Repository<PresentationEntity>,
    ) {}

    afterInit(server: Server) {
        this.server = server;
    }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token;
            if (!token) throw new UnauthorizedException();

            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get<string>('JWT_SECRET'),
            });

            client.data.user = {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
            };
        } catch (err) {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        console.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('subscribe_presentation')
    async handleSubscribePresentation(
        @MessageBody() data: { presentationId: number },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.data.user.id;
        const presentation = await this.presentationRepository
            .createQueryBuilder('presentation')
            .leftJoinAndSelect('presentation.owner', 'owner')
            .leftJoinAndSelect('owner.user', 'ownerUser')
            .leftJoinAndSelect('presentation.participants', 'participant')
            .leftJoinAndSelect('participant.user', 'participantUser')
            .where('presentation.presentationId = :id', { id: data.presentationId })
            .getOne();

        if (!presentation || !this.userHasAccessToPresentation(presentation, userId)) {
            client.emit('error', 'Access denied to presentation');
            return;
        }

        const room = `presentation/${data.presentationId}/events`;
        client.join(room);
        client.emit('subscribed', { room });
    }

    private userHasAccessToPresentation(presentation: PresentationEntity, userId: number): boolean {
        if (presentation.owner?.user?.userId === userId) {
            return true;
        }

        return presentation.participants?.some(
            (participant) => participant.user?.userId === userId,
        );
    }

    emitPresentationEvent(presentationId: number, event: PresentationEventType) {
        const room = `presentation/${presentationId}/events`;
        this.server.to(room).emit('presentationEvent', new PresentationEventDto(event));
    }
}
