import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../common/entities/UserEntity';
import { AuthModule } from '../auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';
import {UserMapper} from "./user.mapper";

@Module({
  controllers: [UserController],
  providers: [UserService, UserMapper],
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    AuthModule,
    MulterModule.register({ dest: './uploads' }),
  ],
  exports: [UserMapper],
})
export class UserModule {}
