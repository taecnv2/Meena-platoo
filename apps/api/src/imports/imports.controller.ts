import { Body, Controller, Post } from '@nestjs/common';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import type { RequestUser } from '../common/types/authenticated-request';
import { ImportIngredientsDto } from './dto/import-ingredients.dto';
import { ImportResult, ImportsService } from './imports.service';

/**
 * Zone scope for opening balances is enforced per row inside ImportsService (each row may name
 * a different zone), since a single @ZoneScope decorator can only check one zone per request.
 */
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_IMPORT)
  @Post('ingredients')
  importIngredients(
    @Body() dto: ImportIngredientsDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ImportResult> {
    return this.importsService.importIngredients(dto, user);
  }
}
