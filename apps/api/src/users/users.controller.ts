import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import type { Types } from 'mongoose';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ExportService, type ExportFormat } from '../export/export.service';
import { RolesService } from '../roles/roles.service';
import { Role } from '../roles/schemas/role.schema';
import { ZonesService } from '../zones/zones.service';
import { Zone } from '../zones/schemas/zone.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { buildUserExportColumns } from './user-export.columns';
import { SafeUser } from './users.service';
import { UsersService } from './users.service';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogsService: AuditLogsService,
    private readonly rolesService: RolesService,
    private readonly zonesService: ZonesService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.USERS_READ)
  @Get()
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.USERS_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const [rows, roles, zones] = await Promise.all([
      this.usersService.findAll(),
      this.rolesService.findAll(),
      this.zonesService.findAll(),
    ]);
    const roleMap = new Map(
      (roles as Array<WithId<Role>>).map((r) => [r._id.toString(), r.name]),
    );
    const zoneMap = new Map(
      (zones as Array<WithId<Zone>>).map((z) => [z._id.toString(), z.name]),
    );
    const buffer = await this.exportService.toFile(
      format,
      rows,
      buildUserExportColumns(roleMap, zoneMap),
      {
        title: 'รายชื่อผู้ใช้งาน',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    await this.exportService.logExport(
      { userId: user.id, entity: 'User', action: 'DATA_EXPORTED' },
      format,
    );
    return this.exportService.streamableFile(buffer, 'users', format);
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
