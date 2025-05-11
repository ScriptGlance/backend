import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email/email.module';
import { PresentationsModule } from './presentations/presentations.module';
import { dataSourceOptions } from '../data-source';
import { RedisModule } from '@nestjs-modules/ioredis';
import {ServeStaticModule} from "@nestjs/serve-static";
import { join } from 'path';
import { SharedVideoModule } from './shared-video/shared-video.module';
import { UserModule } from './user/user.module';
import { ModeratorModule } from './moderator/moderator.module';
import { ChatModule } from './chat/chat.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    RedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AuthModule,
    EmailModule,
    PresentationsModule,
    ServeStaticModule.forRoot({
      serveRoot: '/previews',
      rootPath: join(process.cwd(), 'uploads', 'previews'),
      serveStaticOptions: {
        index: false,
        maxAge: '1h',
      },
    }),
    ServeStaticModule.forRoot({
      serveRoot: '/avatars',
      rootPath: join(process.cwd(), 'uploads', 'avatars'),
      serveStaticOptions: {
        index: false,
        maxAge: '1h',
      },
    }),
    SharedVideoModule,
    UserModule,
    ModeratorModule,
    ChatModule,
  ],
})
export class AppModule {}
