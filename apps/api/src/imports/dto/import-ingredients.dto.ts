import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Blank spreadsheet cells arrive as '' -- treat them as "not provided". */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  value === '' || value === null ? undefined : value;

/** One spreadsheet row, already mapped from Thai/English headers by the web client. */
export class ImportIngredientRowDto {
  /** Original spreadsheet row number (header = 1), used in messages; defaults to array position + 2. */
  @IsOptional()
  @IsInt()
  @Min(1)
  rowNumber?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  code?: string;

  @IsString()
  name!: string;

  /** Category name or code; created when missing (needs categories.create). */
  @IsString()
  category!: string;

  /** Base unit name or code -- the unit stock is kept in; created when missing (needs units.create). */
  @IsString()
  baseUnit!: string;

  /** Optional bigger unit (ลัง/แพ็ค/ถุง) + how many base units it holds. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  packUnit?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  packFactor?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumStock?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maximumStock?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultCost?: number;

  /** Comma-separated. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  tags?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  consignmentOwner?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  description?: string;

  /** Zone name or code for the opening balance. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  zone?: string;

  /** Opening balance (ยอดยกมา) in the base unit -- the zone's stock is SET to this value. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingQuantity?: number;
}

export class ImportIngredientsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3000)
  @ValidateNested({ each: true })
  @Type(() => ImportIngredientRowDto)
  rows!: ImportIngredientRowDto[];

  /** true = validate and preview only, nothing is written. */
  @IsBoolean()
  dryRun!: boolean;
}
