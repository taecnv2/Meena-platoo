import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class TransferItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  /** Unit `quantity` is entered in. Defaults to the ingredient's base unit. */
  @IsOptional()
  @IsMongoId()
  unitId?: string;
}

export class CreateTransferDto {
  @IsMongoId()
  fromZoneId!: string;

  @IsMongoId()
  toZoneId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];
}
