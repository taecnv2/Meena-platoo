import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
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
