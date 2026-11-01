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

  /** Unit `quantity` and `unitCost` are expressed in. Defaults to the ingredient's base unit. */
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  /** Cost per entered unit (e.g. per ลัง when unitId is ลัง). Defaults to the ingredient's defaultCost. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  /** Optional measured weight (kg) recorded alongside a count-based quantity. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
