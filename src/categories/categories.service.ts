import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import defaultSlugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: Prisma.CategoryCreateInput) {
    // Check if category with same name already exists
    const existingByName = await this.prisma.category.findUnique({ 
      where: { name: data.name } 
    });
    if (existingByName) {
      throw new ConflictException('Category with this name already exists');
    }

    let slug = data.slug;
    if (!slug) {
        const rawSlug = defaultSlugify(data.name, { lower: true, strict: true });
        slug = `${rawSlug}`;
    }
    
    const existsBySlug = await this.prisma.category.findUnique({ where: { slug } });
    if (existsBySlug) {
      throw new ConflictException('Category with this slug already exists');
    }
    
    return this.prisma.category.create({ 
        data: {
            ...data,
            slug
        } 
    });
  }

  async findAll() {
    return this.prisma.category.findMany();
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ 
      where: { id }, 
      include: { posts: true } 
    });
    
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    
    return category;
  }

  async update(id: string, data: Prisma.CategoryUpdateInput) {
    // Check if category exists
    await this.findOne(id); // Will throw NotFoundException if not found
    
    // If updating name, check for duplicates
    if (data.name && typeof data.name === 'string') {
      const existingByName = await this.prisma.category.findFirst({
        where: { 
          name: data.name,
          NOT: { id }
        }
      });
      if (existingByName) {
        throw new ConflictException('Category with this name already exists');
      }
    }
    
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    // Check if category exists
    await this.findOne(id); // Will throw NotFoundException if not found
    
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      // Handle foreign key constraint error
      if (error.code === 'P2003' || error.code === 'P2014') {
        throw new ConflictException('Cannot delete category that has posts. Please reassign or delete the posts first.');
      }
      throw error;
    }
  }
}
