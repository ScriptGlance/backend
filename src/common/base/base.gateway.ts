import { UnauthorizedException } from '@nestjs/common';
import { OnGatewayConnection } from '@nestjs/websockets';
import { Socket as BaseSocket } from 'socket.io/dist/socket';
import { SocketData } from '../interface/SocketData';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {Repository} from "typeorm";
import {PresentationEntity} from "../entities/PresentationEntity";

type Socket = BaseSocket<any, any, any, SocketData>;

export abstract class BaseGateway implements OnGatewayConnection {
  protected constructor(
      private readonly jwtService: JwtService,
      private readonly configService: ConfigService,
      protected readonly presentationRepository: Repository<PresentationEntity>,
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

  protected async getPresentationWithAccessControl(
      presentationId: number,
      userId: number,
  ) {
    const presentation = await this.presentationRepository
        .createQueryBuilder('presentation')
        .leftJoinAndSelect('presentation.owner', 'owner')
        .leftJoinAndSelect('owner.user', 'ownerUser')
        .leftJoinAndSelect('presentation.participants', 'participant')
        .leftJoinAndSelect('participant.user', 'participantUser')
        .where('presentation.presentationId = :id', { id: presentationId })
        .getOne();

    return presentation &&
    this.userHasAccessToPresentation(presentation, userId)
        ? presentation
        : null;
  }

  protected userHasAccessToPresentation(
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
}
