import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PostStatus, Prisma, Role, User } from '@prisma/client';
import defaultSlugify from 'slugify';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
  ) {}

  async findByAuthorSlug(slug: string) {
    return this.prisma.post.findMany({
      where: {
        author: {
          slug: slug,
        },
      },
      include: {
        author: { select: { id: true, name: true, email: true, slug: true } },
        category: true,
      },
    });
  }

  async findByCategoryId(categoryId: string) {
    return this.prisma.post.findMany({
      where: {
        categoryId: categoryId,
      },
      include: {
        author: { select: { id: true, name: true, email: true, slug: true } },
        category: true,
      },
    });
  }

  /**
   * Calculate estimated read time based on content word count
   * Assumes average reading speed of 200 words per minute
   */
  private calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.trim().split(/\s+/).length;
    const readTime = Math.ceil(wordCount / wordsPerMinute);
    return readTime > 0 ? readTime : 1; // Minimum 1 minute
  }

  async create(data: CreatePostDto) {
    const rawSlug = defaultSlugify(data.title, { lower: true, strict: true });
    const slug = data.slug || `${rawSlug}`;

    // Check if slug already exists
    const existingPost = await this.prisma.post.findUnique({ where: { slug } });
    if (existingPost) {
      throw new NotFoundException(`A post with slug "${slug}" already exists. Please use a different title or provide a custom slug.`);
    }

    const author = await this.prisma.user.findUnique({ where: { id: data.authorId } });
    if (!author) {
      throw new NotFoundException(`Author with id "${data.authorId}" not found`);
    }

    const category = await this.prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      throw new NotFoundException(`Category with id "${data.categoryId}" not found`);
    }

    // Calculate readTime if not provided
    const readTime = data.readTime ?? this.calculateReadTime(data.content);

    // Transform DTO to Prisma input
    const createInput: Prisma.PostCreateInput = {
      title: data.title,
      slug,
      content: data.content,
      readTime,
      featuredImage: data.featuredImage,
      featuredImagePublicId: data.featuredImagePublicId,
      author: { connect: { id: data.authorId } },
      category: { connect: { id: data.categoryId } },
    };

    return this.prisma.post.create({ 
      data: createInput,
      include: {
        author: { select: { id: true, name: true, email: true, slug: true } },
        category: true,
      },
    });
  }

  async findAll(options?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = options?.sortBy || 'createdAt';
    const sortOrder = options?.sortOrder || 'desc';

    const [data, total] = await Promise.all([
      this.prisma.post.findMany({
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          author: { select: { id: true, name: true, email: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.post.count(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, slug: true } },
        category: true,
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async update(id: string, data: Prisma.PostUpdateInput, user: User, newImageData?: { url: string; publicId: string }) {
    const post = await this.findOne(id);
    
    // Check permission: Admin or Author of the post
    if (user.role !== Role.ADMIN && post.authorId !== user.id) {
      throw new UnauthorizedException('You can only update your own posts');
    }

    // If new image is provided, delete the old one from Cloudinary
    if (newImageData && post.featuredImagePublicId) {
      await this.cloudinary.deleteImage(post.featuredImagePublicId);
    }

    // Handle publishedAt automatically based on status changes
    let updateData = newImageData 
      ? { ...data, featuredImage: newImageData.url, featuredImagePublicId: newImageData.publicId }
      : { ...data };

    // Auto-set publishedAt when status changes to PUBLISHED
    if (data.status === PostStatus.PUBLISHED && !post.publishedAt) {
      updateData.publishedAt = new Date();
    }
    
    // Clear publishedAt when status changes away from PUBLISHED
    if (data.status && data.status !== PostStatus.PUBLISHED && post.publishedAt) {
      updateData.publishedAt = null;
    }

    return this.prisma.post.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, email: true, slug: true } },
        category: true,
      },
    });
  }

  async remove(id: string, user: User) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: {
        inlineImages: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (user.role !== Role.ADMIN && post.authorId !== user.id) {
      throw new UnauthorizedException('You can only delete your own posts');
    }

    // Delete featured image from Cloudinary if it exists
    if (post.featuredImagePublicId) {
      await this.cloudinary.deleteImage(post.featuredImagePublicId);
    }

    // Delete all inline images from Cloudinary
    if (post.inlineImages && post.inlineImages.length > 0) {
      console.log(`🗑️ Deleting ${post.inlineImages.length} inline images from Cloudinary`);
      for (const image of post.inlineImages) {
        await this.cloudinary.deleteImage(image.publicId);
      }
    }

    // Delete post (cascade will delete inline image records)
    return this.prisma.post.delete({ where: { id } });
  }

  async uploadImage(file: Express.Multer.File) {
    return this.cloudinary.uploadImage(file);
  }

  // Admin specific or status updates
  async updateStatus(id: string, status: PostStatus, user: User) {
     return this.update(id, { status }, user);
  }

  async uploadInlineImage(postId: string, file: Express.Multer.File) {
    // Verify post exists
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Upload to Cloudinary
    const uploadResult = await this.cloudinary.uploadImage(file);

    // Track in database
    const postImage = await this.prisma.postImage.create({
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        postId: postId,
      },
    });

    return {
      url: postImage.url,
      id: postImage.id,
    };
  }
}
