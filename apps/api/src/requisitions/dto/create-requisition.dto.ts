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

export class CreateRequisitionItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  requestedQuantity!: number;

  /** Unit `requestedQuantity` is entered in; converted to the base unit on create. */
  @IsOptional()
  @IsMongoId()
  unitId?: string;
}

export class CreateRequisitionDto {
  @IsMongoId()
  fromZoneId!: string;

  @IsMongoId()
  toZoneId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionItemDto)
  items!: CreateRequisitionItemDto[];
}
