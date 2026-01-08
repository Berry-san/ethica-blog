
import { Role } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

  @Transform(({ value }) => value?.toUpperCase())
  @IsEnum(Role, { message: 'Role must be one of: SUPER_ADMIN, ADMIN, EDITOR, AUTHOR' })
  role: Role;
}
