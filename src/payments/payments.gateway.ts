import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket as BaseSocket, Server } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { SocketData } from '../common/interface/SocketData';
import { BaseGateway } from '../common/base/base.gateway';
import { PaymentEventType } from '../common/enum/PaymentEventType';
import { PaymentEventDto } from './dto/PaymentEventDto';

type Socket = BaseSocket<any, any, any, SocketData>;

@WebSocketGateway({ cors: true, namespace: 'payments' })
@Injectable()
export class PaymentsGateway
  extends BaseGateway
  implements OnGatewayDisconnect, OnGatewayInit
{
  private server: Server;
  private userSockets = new Map<number, string>();

  constructor(jwtService: JwtService, configService: ConfigService) {
    super(jwtService, configService);
  }

  afterInit(server: Server) {
    this.server = server;
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.id;
    if (userId) {
      this.userSockets.delete(userId);
    }
  }

  @SubscribeMessage('subscribe_payments')
  handleSubscribePresentation(@ConnectedSocket() client: Socket) {
    const userId = client.data.user?.id;
    if (!userId) {
      client.emit('error', 'User not authenticated');
      return;
    }
    this.userSockets.set(userId, client.id);
  }

  emitPaymentsEvent(userId: number, event: PaymentEventType) {
    const socketId = this.userSockets.get(userId);
    const dto: PaymentEventDto = {
      event_type: event,
    };
    if (socketId) {
      this.server.to(socketId).emit('payments_event', dto);
    }
  }
}
