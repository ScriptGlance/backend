import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './auth/entities/UserEntity';
import { ModeratorEntity } from './auth/entities/ModeratorEntity';
import { AdminEntity } from './auth/entities/AdminEntity';
import { PasswordResetTokenEntity } from './auth/entities/PasswordResetTokenEntity';
import { EmailVerificationCodeEntity } from './auth/entities/EmailVerificationCodeEntity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [
          UserEntity,
          ModeratorEntity,
          AdminEntity,
          PasswordResetTokenEntity,
          EmailVerificationCodeEntity,
        ],
        synchronize: configService.get<boolean>('DEBUG'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
