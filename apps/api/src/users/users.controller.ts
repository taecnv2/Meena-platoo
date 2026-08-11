import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SafeUser } from './users.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermission(PERMISSION_CODES.USERS_READ)
  @Get()
  findAll(): Promise<SafeUser[]> {
    return this.usersService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.USERS_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<SafeUser> {
    return this.usersService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.USERS_CREATE)
  @Post()
  create(@Body() dto: CreateUserDto): Promise<SafeUser> {
    return this.usersService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.USERS_UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<SafeUser> {
    return this.usersService.update(id, dto);
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
