import { Type } from 'class-transformer';
import {
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import {
  STOCK_OUT_REASONS,
  type StockOutReason,
} from '../../stock-movements/schemas/stock-movement.schema';

export class StockOutDto {
  @IsMongoId()
  ingredientId!: string;

  @IsMongoId()
  zoneId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  /** Unit `quantity` is expressed in. Defaults to the ingredient's base unit. */
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  /** Defaults to KITCHEN_USE. SALE feeds the consignment sales report; STAFF_MEAL tracks staff food. */
  @IsOptional()
  @IsIn(STOCK_OUT_REASONS)
  reason?: StockOutReason;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
