import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { UNIT_TYPES, type UnitType } from '../schemas/unit.schema';

export class CreateUnitDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(UNIT_TYPES)
  type!: UnitType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  conversionFactor?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
