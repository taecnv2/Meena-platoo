import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { StockMovementsService } from './stock-movements.service';
import {
  MOVEMENT_TYPES,
  MovementType,
  StockMovement,
} from './schemas/stock-movement.schema';

@Controller('stock-movements')
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @RequirePermission(PERMISSION_CODES.INVENTORY_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('ingredientId') ingredientId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('movementType') movementType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StockMovement[]> {
    const resolvedType = (MOVEMENT_TYPES as readonly string[]).includes(
      movementType ?? '',
    )
      ? (movementType as MovementType)
      : undefined;
    return this.stockMovementsService.findAll({
      ingredientId,
      zoneId,
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      movementType: resolvedType,
      dateFrom,
      dateTo,
    });
  }
}
