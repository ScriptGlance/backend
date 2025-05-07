import { UnauthorizedException } from '@nestjs/common';
import { OnGatewayConnection } from '@nestjs/websockets';
import { Socket as BaseSocket } from 'socket.io/dist/socket';
import { SocketData } from '../interface/SocketData';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

type Socket = BaseSocket<any, any, any, SocketData>;

export abstract class BaseGateway implements OnGatewayConnection {
  protected constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new UnauthorizedException();

      const payload: {
        sub: number;
        email: string;
        role: string;
      } = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch (err) {
      console.error(err);
      client.disconnect();
    }
  }
}
