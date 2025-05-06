import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './email/email.module';
import { PresentationsModule } from './presentations/presentations.module';
import { dataSourceOptions } from '../data-source';
import { RedisModule } from '@nestjs-modules/ioredis';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
