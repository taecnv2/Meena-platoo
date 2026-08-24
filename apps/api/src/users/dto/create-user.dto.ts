import {
  IsArray,
  IsEmail,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsMongoId()
  roleId!: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  zoneIds?: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
