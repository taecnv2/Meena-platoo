import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { Transfer } from './schemas/transfer.schema';
import { TransfersService } from './transfers.service';

@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @RequirePermission(PERMISSION_CODES.TRANSFER_READ)
  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<Transfer[]> {
    return this.transfersService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
    });
  }

  @RequirePermission(PERMISSION_CODES.TRANSFER_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Transfer> {
    return this.transfersService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.TRANSFER_CREATE)
  @ZoneScope({ source: 'body', field: 'fromZoneId' })
  @Post()
  create(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Transfer> {
    return this.transfersService.createDirectTransfer(dto, user.id);
  }
}
