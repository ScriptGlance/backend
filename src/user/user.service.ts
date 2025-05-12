import {Injectable, InternalServerErrorException, NotFoundException} from '@nestjs/common';
import { StandardResponse } from '../common/interface/StandardResponse';
import { ConfigDto } from './dto/ConfigDto';
import {InjectRepository} from "@nestjs/typeorm";
import {UserEntity} from "../common/entities/UserEntity";
import {Repository} from "typeorm";
import {UserMapper} from "./user.mapper";
import {UserDto} from "./dto/UserDto";
import {UserWithPremiumEntity} from "../common/entities/UserWithPremiumEntity";
import { promises as fs } from 'fs';
import {
  FREE_VIDEOS_PER_PRESENTATION, MAX_FREE_PARTICIPANTS_COUNT,
  MAX_FREE_RECORDING_TIME_SECONDS, PREMIUM_PRICE_CENTS,
  WORDS_PER_MINUTE_MAX,
  WORDS_PER_MINUTE_MIN
} from "../common/Constants";
import {join} from "path";
import {use} from "passport";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UserService {

  constructor(
      @InjectRepository(UserEntity)
      private readonly userRepository: Repository<UserEntity>,
      private readonly userMapper: UserMapper,
  ) {
  }

  getConfig(): StandardResponse<ConfigDto> {
    return {
      data: {
        words_per_minute_min: WORDS_PER_MINUTE_MIN,
        words_per_minute_max: WORDS_PER_MINUTE_MAX,
        premium_config: {
          max_free_recording_time_seconds: MAX_FREE_RECORDING_TIME_SECONDS,
          max_free_participants_count: MAX_FREE_PARTICIPANTS_COUNT,
          max_free_video_count: FREE_VIDEOS_PER_PRESENTATION,
          premium_price_cents: PREMIUM_PRICE_CENTS,
        },
      },
      error: false,
    };
  }

  async getProfile(userId: number): Promise<StandardResponse<UserDto>> {
    const user = await this.userRepository
        .createQueryBuilder('u')
        .leftJoinAndMapOne(
            'u.userPremium',
            UserWithPremiumEntity,
            'prem',
            'prem.user_id = prem.user_id',
        )
        .where('u.user_id = :id', { id: userId })
        .getOne();

    return {
      data: this.userMapper.toUserDto(user!),
      error: false,
    }
  }

  async changeProfile(
      userId: number,
      firstName: string,
      lastName: string,
      avatar: Express.Multer.File | null,
      password: string = '',
  ): Promise<StandardResponse<UserDto>> {
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) {
      throw new NotFoundException(`User #${userId} not found`);
    }

    if (firstName) {
      user.firstName = firstName;
    }
    if (lastName) {
      user.lastName = lastName;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
      user.isTemporaryPassword = false;
    }

    if (avatar) {
      if (user.avatar) {
        const oldPath = join(
            process.cwd(),
            user.avatar,
        );
        try {
          await fs.unlink(oldPath);
        } catch (err) {
          if (err.code !== 'ENOENT') {
            throw new InternalServerErrorException('Failed to remove old avatar');
          }
        }
      }
      user.avatar = avatar.path;
    }

    const updated = await this.userRepository.save(user);
    return {
      data: this.userMapper.toUserDto(updated),
      error: false,
    };
  }
}
