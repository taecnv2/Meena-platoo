import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../decorators/allow-password-change-pending.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class ForcePasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_PENDING_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isAllowed) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.mustChangePassword) {
      throw new ForbiddenException('กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ');
    }
    return true;
  }
}
