import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class FulfillRequisitionItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

export class FulfillRequisitionDto {
  @IsMongoId()
  fromZoneId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FulfillRequisitionItemDto)
  items!: FulfillRequisitionItemDto[];
}
