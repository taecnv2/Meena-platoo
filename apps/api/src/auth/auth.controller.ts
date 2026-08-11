import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../config/configuration';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuthService, type AuthResult } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken'>> {
    const result = await this.authService.login(
      dto.username,
      dto.password,
      this.meta(req),
    );
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Omit<AuthResult, 'refreshToken'>> {
    const rawToken = this.readRefreshCookie(req);
    const result = await this.authService.refresh(rawToken, this.meta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: true }> {
    const rawToken = req.cookies?.[this.cookieName()] as string | undefined;
    await this.authService.logout(rawToken);
    res.clearCookie(this.cookieName(), this.cookieOptions());
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser): RequestUser {
    return user;
  }

  private meta(req: Request): { userAgent?: string; ipAddress?: string } {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }

  private cookieName(): string {
    return this.configService.get('refreshCookieName', { infer: true });
  }

  private cookieOptions(): CookieOptions {
    const nodeEnv = this.configService.get('nodeEnv', { infer: true });
    return {
      httpOnly: true,
      secure: nodeEnv === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(this.cookieName(), token, this.cookieOptions());
  }

  private readRefreshCookie(req: Request): string {
    const raw = req.cookies?.[this.cookieName()] as string | undefined;
    if (!raw) {
      throw new UnauthorizedException('ไม่พบเซสชัน กรุณาเข้าสู่ระบบใหม่');
    }
    return raw;
  }
}
