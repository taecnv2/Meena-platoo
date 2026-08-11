import {
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
