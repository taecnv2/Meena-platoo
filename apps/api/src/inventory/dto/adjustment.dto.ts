import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  NotEquals,
} from 'class-validator';

export class AdjustmentDto {
  @IsMongoId()
  ingredientId!: string;

  @IsMongoId()
  zoneId!: string;

  /** Signed delta applied to the current zone quantity (negative = decrease). */
  @Type(() => Number)
  @IsNumber()
  @NotEquals(0)
  quantityDelta!: number;

  /** Unit `quantityDelta` is expressed in. Defaults to the ingredient's base unit. */
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
