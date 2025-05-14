import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/express';

export const GetUser = createParamDecorator<
  keyof AuthUser, // the “data” argument type
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  AuthUser | AuthUser[keyof AuthUser] // the return type
>(
  (
    data: keyof AuthUser | undefined,
    ctx: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  ): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    const user = request.user;

    // now user[data] is statically known to be AuthUser[keyof AuthUser]
    return data ? user[data] : user;
  },
);
