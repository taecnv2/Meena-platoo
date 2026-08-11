import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockCountItemInputDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualQuantity!: number;
}

export class CreateStockCountDto {
  @IsMongoId()
  zoneId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockCountItemInputDto)
  items!: StockCountItemInputDto[];
}
