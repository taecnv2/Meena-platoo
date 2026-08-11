import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class StockOutDto {
  @IsMongoId()
  ingredientId!: string;

  @IsMongoId()
  zoneId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsString()
  remark?: string;
}
