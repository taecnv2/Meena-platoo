import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class StockInDto {
  @IsMongoId()
  ingredientId!: string;

  @IsMongoId()
  zoneId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
