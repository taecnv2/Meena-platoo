import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../config/configuration';
import type { RequestUser } from '../../common/types/authenticated-request';
import { UsersService } from '../../users/users.service';

interface AccessTokenPayload {
  sub: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.accessSecret', { infer: true }),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const authContext = await this.usersService.findAuthContextById(
      payload.sub,
    );
    if (!authContext) {
      throw new UnauthorizedException('ผู้ใช้งานไม่ถูกต้อง');
    }
    if (authContext.status !== 'ACTIVE') {
      throw new UnauthorizedException('บัญชีผู้ใช้งานถูกระงับการใช้งาน');
    }
    return {
      id: authContext.id,
      username: authContext.username,
      roleId: authContext.roleId,
      roleName: authContext.roleName,
      permissions: authContext.permissions,
      zoneIds: authContext.zoneIds,
      isSuperScope: authContext.isSuperScope,
    };
  }
}
