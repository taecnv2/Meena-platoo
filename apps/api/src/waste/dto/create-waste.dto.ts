import { Type } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { WASTE_REASONS, type WasteReason } from '../schemas/waste.schema';

export class CreateWasteDto {
  @IsMongoId()
  zoneId!: string;

  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsEnum(WASTE_REASONS)
  reason!: WasteReason;

  @IsOptional()
  @IsString()
  remark?: string;
}
