import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ZONE_TYPES, type ZoneType } from '../schemas/zone.schema';

export class CreateZoneDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsIn(ZONE_TYPES)
  type!: ZoneType;

  @IsOptional()
  @IsString()
  description?: string;
}
