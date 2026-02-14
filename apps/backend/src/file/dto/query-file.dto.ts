import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryFileDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
