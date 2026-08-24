import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import type { AppConfig } from '../config/configuration';
import { parseDurationMs } from '../common/utils/duration';
import { AuthContext, UsersService } from '../users/users.service';
import { Session, SessionDocument } from './schemas/session.schema';

export interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<AuthContext, 'status'>;
}

interface RefreshPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async login(
    username: string,
    password: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const user = await this.usersService.findByUsernameWithPassword(username);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    }
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    }
    const authContext = await this.usersService.findAuthContextById(
      user._id.toString(),
    );
    if (!authContext) {
      throw new UnauthorizedException('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    }
    await this.usersService.touchLastLogin(authContext.id);
    return this.issueSession(authContext, meta);
  }

  async refresh(rawToken: string, meta: SessionMeta): Promise<AuthResult> {
    const payload = this.verifyRefreshToken(rawToken);
    const session = await this.sessionModel.findById(payload.sid);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
    const matches = await bcrypt.compare(rawToken, session.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
    }
    // Rotate: this refresh token can never be used again, blocking replay.
    session.revokedAt = new Date();
    await session.save();

    const authContext = await this.usersService.findAuthContextById(
      payload.sub,
    );
    if (!authContext || authContext.status !== 'ACTIVE') {
      throw new UnauthorizedException('บัญชีผู้ใช้งานถูกระงับการใช้งาน');
    }
    return this.issueSession(authContext, meta);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.usersService.changePassword(
      userId,
      currentPassword,
      newPassword,
    );
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    try {
      const payload = this.verifyRefreshToken(rawToken);
      await this.sessionModel.updateOne(
        { _id: payload.sid },
        { revokedAt: new Date() },
      );
    } catch {
      // Token already invalid/expired: nothing to revoke.
    }
  }

  private async issueSession(
    authContext: AuthContext,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const accessExpiresIn = this.configService.get('jwt.accessExpiresIn', {
      infer: true,
    });
    const accessToken = this.jwtService.sign(
      { sub: authContext.id },
      {
        secret: this.configService.get('jwt.accessSecret', { infer: true }),
        expiresIn: Math.floor(parseDurationMs(accessExpiresIn) / 1000),
      },
    );

    const refreshExpiresIn = this.configService.get('jwt.refreshExpiresIn', {
      infer: true,
    });
    const refreshExpiresSeconds = Math.floor(
      parseDurationMs(refreshExpiresIn) / 1000,
    );
    const expiresAt = new Date(Date.now() + refreshExpiresSeconds * 1000);
    const session = await this.sessionModel.create({
      userId: authContext.id,
      refreshTokenHash: 'pending',
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt,
      revokedAt: null,
    });

    const refreshToken = this.jwtService.sign(
      { sub: authContext.id, sid: session._id.toString() },
      {
        secret: this.configService.get('jwt.refreshSecret', { infer: true }),
        expiresIn: refreshExpiresSeconds,
      },
    );
    session.refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.configService.get('bcryptSaltRounds', { infer: true }),
    );
    await session.save();

    const user: Omit<AuthContext, 'status'> = {
      id: authContext.id,
      username: authContext.username,
      roleId: authContext.roleId,
      roleName: authContext.roleName,
      permissions: authContext.permissions,
      zoneIds: authContext.zoneIds,
      isSuperScope: authContext.isSuperScope,
      mustChangePassword: authContext.mustChangePassword,
    };

    return { accessToken, refreshToken, user };
  }

  private verifyRefreshToken(rawToken: string): RefreshPayload {
    try {
      return this.jwtService.verify<RefreshPayload>(rawToken, {
        secret: this.configService.get('jwt.refreshSecret', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }
  }
}
