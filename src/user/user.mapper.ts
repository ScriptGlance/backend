import { Injectable } from '@nestjs/common';
import { UserEntity } from '../common/entities/UserEntity';
import { UserDto } from './dto/UserDto';
@Injectable()
export class UserMapper {
  toUserDto(user: UserEntity): UserDto {
    return {
      avatar: user.avatar ? '/' + user.avatar.replace('uploads/', '') : null,
      user_id: user.userId,
      first_name: user.firstName,
      last_name: user.lastName,
      has_premium: user.userPremium?.has_premium ?? false,
      email: user.email,
      registered_at: user.registeredAt,
      is_temporary_password: user.isTemporaryPassword,
    };
  }
}
