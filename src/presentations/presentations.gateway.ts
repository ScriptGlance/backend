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
import { BasePresentationGateway } from '../common/base/basePresentation.gateway';

type Socket = BaseSocket<any, any, any, SocketData>;

@WebSocketGateway({ cors: true })
@Injectable()
export class PresentationsGateway
  extends BasePresentationGateway
  implements OnGatewayDisconnect, OnGatewayInit
{
  private server: Server;

  constructor(
    jwtService: JwtService,
    configService: ConfigService,
    @InjectRepository(PresentationEntity)
    presentationRepository: Repository<PresentationEntity>,
  ) {
    super(jwtService, configService, presentationRepository);
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

    const presentation = await this.getPresentationWithAccessControl(
      data.presentationId,
      userId,
    );

    if (!presentation) {
      client.emit('error', 'Access denied to presentation');
      return;
    }

    const room = `presentation/${data.presentationId}/events`;
    await client.join(room);
    client.emit('subscribed', { room });
  }

  emitPresentationEvent(presentationId: number, event: PresentationEventType) {
    const room = `presentation/${presentationId}/events`;
    this.server
      .to(room)
      .emit('presentationEvent', new PresentationEventDto(event));
  }
}
