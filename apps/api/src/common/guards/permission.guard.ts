import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<
      string | undefined
    >(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์ดำเนินการนี้');
    }
    return true;
  }
}
