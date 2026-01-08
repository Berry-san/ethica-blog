
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

// Note: Using @nestjs/swagger PartialType is recommended if using Swagger
// If not, use @nestjs/mapped-types PartialType
import { PartialType as MappedPartialType } from '@nestjs/mapped-types';

export class UpdateUserDto extends MappedPartialType(CreateUserDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
