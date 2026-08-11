import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import {
  ZONE_SCOPE_KEY,
  type ZoneScopeOptions,
} from '../decorators/zone-scope.decorator';
import type { AuthenticatedRequest } from '../types/authenticated-request';

/**
 * Enforces plan.md §13-16: a user may hold a permission (e.g. requisition.approve)
 * while still being restricted to acting only within their assigned Zones.
 * Owner / any role with allZoneAccess (isSuperScope) bypasses this check entirely.
 */
@Injectable()
export class ZoneScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<
      ZoneScopeOptions | undefined
    >(ZONE_SCOPE_KEY, [context.getHandler(), context.getClass()]);
    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user.isSuperScope) {
      return true;
    }

    const targetZoneId = await this.resolveZoneId(options, request);
    if (!targetZoneId) {
      throw new BadRequestException('ไม่พบข้อมูล Zone ในคำขอ');
    }
    if (!user.zoneIds.includes(targetZoneId)) {
      throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึง Zone นี้');
    }
    return true;
  }

  private async resolveZoneId(
    options: ZoneScopeOptions,
    request: AuthenticatedRequest,
  ): Promise<string | undefined> {
    switch (options.source) {
      case 'param':
        return asString(request.params[options.field]);
      case 'query':
        return asString(request.query[options.field]);
      case 'body': {
        const body = request.body as Record<string, unknown> | undefined;
        return asString(body?.[options.field]);
      }
      case 'entity': {
        if (!options.lookupService) {
          throw new Error('ZoneScope entity source requires a lookupService');
        }
        const service = this.moduleRef.get(options.lookupService, {
          strict: false,
        });
        const idParam = options.idParam ?? 'id';
        const entityId = asString(request.params[idParam]);
        if (!entityId) {
          return undefined;
        }
        return service.findZoneIdById(entityId, options.field);
      }
      default:
        return undefined;
    }
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
