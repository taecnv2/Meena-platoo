import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ModuleRef, Reflector } from '@nestjs/core';
import type { ZoneScopeOptions } from '../decorators/zone-scope.decorator';
import { ZoneScopeGuard } from './zone-scope.guard';

describe('ZoneScopeGuard', () => {
  const contextFor = (body: Record<string, unknown>, zoneIds: string[]) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({
          body,
          params: {},
          query: {},
          user: { isSuperScope: false, zoneIds },
        }),
      }),
    }) as unknown as ExecutionContext;
  const guardWith = (options: ZoneScopeOptions) =>
    new ZoneScopeGuard(
      { getAllAndOverride: () => options } as unknown as Reflector,
      {} as ModuleRef,
    );

  it('lets a request without a zone through when the scope is optional', async () => {
    const guard = guardWith({
      source: 'body',
      field: 'zoneId',
      optional: true,
    });
    await expect(guard.canActivate(contextFor({}, []))).resolves.toBe(true);
  });

  it('still checks a zone that is supplied on an optional scope', async () => {
    const guard = guardWith({
      source: 'body',
      field: 'zoneId',
      optional: true,
    });
    await expect(
      guard.canActivate(contextFor({ zoneId: 'z2' }, ['z1'])),
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires a zone when the scope is not optional', async () => {
    const guard = guardWith({ source: 'body', field: 'zoneId' });
    await expect(guard.canActivate(contextFor({}, ['z1']))).rejects.toThrow(
      BadRequestException,
    );
  });
});
