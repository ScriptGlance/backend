import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket as BaseSocket, Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { PresentationEntity } from '../common/entities/PresentationEntity';
import { InjectRepository } from '@nestjs/typeorm';
import { PresentationEventDto } from './dto/PresentationEventDto';
import { PresentationEventType } from '../common/enum/PresentationEventType';
import { SocketData } from '../common/interface/SocketData';
import { BaseGateway } from '../common/base/base.gateway';

type Socket = BaseSocket<any, any, any, SocketData>;

@WebSocketGateway({ cors: true })
@Injectable()
export class PresentationGateway
  extends BaseGateway
  implements OnGatewayDisconnect, OnGatewayInit
{
  private server: Server;

  constructor(
    jwtService: JwtService,
    configService: ConfigService,
    @InjectRepository(PresentationEntity)
    private readonly presentationRepository: Repository<PresentationEntity>,
  ) {
    super(jwtService, configService);
  }

  afterInit(server: Server) {
    this.server = server;
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_presentation')
  async handleSubscribePresentation(
    @MessageBody() data: { presentationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.user?.id;
    if (!userId) {
      client.emit('error', 'User not authenticated');
      return;
    }

    const presentation = await this.presentationRepository
      .createQueryBuilder('presentation')
      .leftJoinAndSelect('presentation.owner', 'owner')
      .leftJoinAndSelect('owner.user', 'ownerUser')
      .leftJoinAndSelect('presentation.participants', 'participant')
      .leftJoinAndSelect('participant.user', 'participantUser')
      .where('presentation.presentationId = :id', { id: data.presentationId })
      .getOne();

    if (
      !presentation ||
      !this.userHasAccessToPresentation(presentation, userId)
    ) {
      client.emit('error', 'Access denied to presentation');
      return;
    }

    const room = `presentation/${data.presentationId}/events`;
    await client.join(room);
    client.emit('subscribed', { room });
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

  emitPresentationEvent(presentationId: number, event: PresentationEventType) {
    const room = `presentation/${presentationId}/events`;
    this.server
      .to(room)
      .emit('presentationEvent', new PresentationEventDto(event));
  }
}
