import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductionOutputDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsMongoId()
  unitId?: string;

  /** Grams per entered unit (e.g. 100 for a 100 g bag). When every output has one, cost is split by weight. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  portionWeight?: number;
}

export class CreateProductionDto {
  @IsMongoId()
  zoneId!: string;

  @IsMongoId()
  inputIngredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  inputQuantity!: number;

  @IsOptional()
  @IsMongoId()
  inputUnitId?: string;

  /** Cost per entered input unit (e.g. 440 บาท/kg). Defaults to the raw ingredient's defaultCost. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  inputUnitCost?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((output: ProductionOutputDto) => output.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => ProductionOutputDto)
  outputs!: ProductionOutputDto[];

  /** Trim/scrap, in the input's entered unit. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wasteQuantity?: number;

  /** Copy each output's computed cost per unit onto its Ingredient.defaultCost. */
  @IsOptional()
  @IsBoolean()
  updateDefaultCost?: boolean;

  @IsOptional()
  @IsString()
  remark?: string;
}
