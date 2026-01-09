import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import defaultSlugify from 'slugify';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UsersService } from '../users/users.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly usersService: UsersService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('featuredImage'))
  async create(
    @Body() createPostDto: CreatePostDto, 
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
      try {
        // Validate that image is provided
        if (!file) {
            throw new BadRequestException('Featured image is required');
        }

        const { categoryId, authorId, content, title, slug: providedSlug, readTime, ...rest } = createPostDto;

        // Validate author exists
        const author = await this.usersService.findById(authorId);
        if (!author) {
            throw new BadRequestException(`Author with ID ${authorId} not found. Please create the author first.`);
        }

        // Note: Category validation is handled by Prisma foreign key constraint
        // If category doesn't exist, Prisma will throw an error which we catch below
        
        // Generate slug from title if not provided
        const slug = providedSlug || defaultSlugify(title, { lower: true, strict: true });

        // Calculate read time if not provided
        const calculatedReadTime = readTime || Math.ceil(content.split(/\s+/).length / 200);

        // Upload image to Cloudinary
        const uploadResult = await this.postsService.uploadImage(file);
        const featuredImageUrl = uploadResult.secure_url;
        const featuredImagePublicId = uploadResult.public_id;

        const data: CreatePostDto = {
            title,
            content,
            categoryId,
            authorId,
            readTime: calculatedReadTime,
            slug,
            featuredImage: featuredImageUrl,
            featuredImagePublicId: featuredImagePublicId,
        };
        
        return this.postsService.create(data, req.user);
      } catch (error) {
        // Handle Prisma foreign key constraint errors
        if (error.code === 'P2003') {
          throw new BadRequestException(`Category with ID ${createPostDto.categoryId} not found. Please create the category first.`);
        }
        // Re-throw other errors
        throw error;
      }
  }

  @Get('author/:slug')
  getPostsByAuthor(@Param('slug') slug: string) {
      return this.postsService.findByAuthorSlug(slug);
  }

  @Get('category/:categoryId')
  getPostsByCategory(@Param('categoryId') categoryId: string) {
      return this.postsService.findByCategoryId(categoryId);
  }

  @Get(':slug')
  getPostBySlug(@Param('slug') slug: string) {
      return this.postsService.getPostsBySlug(slug);
  }

  @Post(':id/upload-inline-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  async uploadInlineImage(
    @Param('id') postId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    return this.postsService.uploadInlineImage(postId, file);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
      const result = await this.postsService.uploadImage(file);
      return { url: result.secure_url };
  }

  @Get('published')
  getPublishedPosts(@Query() query: PaginationDto) {
    return this.postsService.findPublishedPosts({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.postsService.findAll({
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('featuredImage'))
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    try {
      // Upload new image to Cloudinary if provided
      let newImageData: { url: string; publicId: string } | undefined;
      if (file) {
        const uploadResult = await this.postsService.uploadImage(file);
        newImageData = {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        };
      }

      // Transform UpdatePostDto to Prisma.PostUpdateInput
      const { authorId, categoryId, slug: providedSlug, title, ...rest } = updatePostDto;
      
      const updateData: Prisma.PostUpdateInput = {
        ...rest,
      };

      // Handle title and slug together - they should be hand in hand
      if (title) {
        updateData.title = title;
        // Auto-generate slug from title if not explicitly provided
        updateData.slug = providedSlug || defaultSlugify(title, { lower: true, strict: true });
      } else if (providedSlug) {
        // Only update slug if explicitly provided without title
        updateData.slug = providedSlug;
      }

      // Handle author update if provided
      if (authorId) {
        const author = await this.usersService.findById(authorId);
        if (!author) {
          throw new BadRequestException(`Author with ID ${authorId} not found. Please create the author first.`);
        }
        updateData.author = { connect: { id: authorId } };
      }

      // Handle category update if provided
      if (categoryId) {
        updateData.category = { connect: { id: categoryId } };
      }

      return this.postsService.update(id, updateData, req.user, newImageData);
    } catch (error) {
      // Handle Prisma foreign key constraint errors
      if (error.code === 'P2003') {
        throw new BadRequestException(`Category with ID ${updatePostDto.categoryId} not found. Please create the category first.`);
      }
      // Re-throw other errors
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @Request() req) {
    return this.postsService.remove(id, req.user);
  }
}
