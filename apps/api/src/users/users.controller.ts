import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SafeUser } from './users.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  @RequirePermission(PERMISSION_CODES.USERS_READ)
  @Get()
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.USERS_CREATE)
  @Get('default-password')
  getDefaultPassword(): { password: string } {
    return { password: this.usersService.getDefaultPassword() };
  }

  @RequirePermission(PERMISSION_CODES.USERS_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.USERS_CREATE)
  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<SafeUser> {
    const user = await this.usersService.create(dto);
    await this.auditLogsService.log({
      userId: actor.id,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user._id.toString(),
      after: user,
    });
    return user;
  }

  @RequirePermission(PERMISSION_CODES.USERS_UPDATE)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<SafeUser> {
    const before = await this.usersService.findById(id);
    const after = await this.usersService.update(id, dto);
    await this.auditLogsService.log({
      userId: actor.id,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: id,
      before,
      after,
    });
    return after;
  }

  @RequirePermission(PERMISSION_CODES.USERS_DISABLE)
  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ): Promise<SafeUser> {
    return this.usersService.setStatus(id, dto.status);
  }

  @RequirePermission(PERMISSION_CODES.USERS_UPDATE)
  @Patch(':id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: true }> {
    await this.usersService.resetPassword(id, dto.newPassword);
    return { success: true };
  }
}
