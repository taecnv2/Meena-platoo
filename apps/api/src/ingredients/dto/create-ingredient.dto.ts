import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngredientUnitConversionDto {
  @IsMongoId()
  unitId!: string;

  /** How many base units one of `unitId` holds (e.g. 12 for 1 ลัง = 12 ขวด). */
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  factor!: number;
}

export class CreateIngredientDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsMongoId()
  categoryId!: string;

  @IsMongoId()
  baseUnitId!: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maximumStock?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  defaultCost?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique((conversion: IngredientUnitConversionDto) => conversion.unitId)
  @ValidateNested({ each: true })
  @Type(() => IngredientUnitConversionDto)
  unitConversions?: IngredientUnitConversionDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  consignmentOwner?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
