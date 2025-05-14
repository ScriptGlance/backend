import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AuthUser } from '../common/types/express';
import { Request } from 'express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.get<string[]>(ROLES_KEY, ctx.getHandler()) ??
      this.reflector.get<string[]>(ROLES_KEY, ctx.getClass());
    if (!requiredRoles) return true;

    const req: Request = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser;
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
