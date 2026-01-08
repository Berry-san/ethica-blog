
import { PartialType } from '@nestjs/swagger';
import { PostStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}
