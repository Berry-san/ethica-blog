import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as argon2 from 'argon2';
import defaultSlugify from 'slugify';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorInfo, SafeUser, UserWithPosts } from './types/user.types';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(data: Omit<Prisma.UserCreateInput, 'slug'>): Promise<SafeUser> {
    const baseSlug = defaultSlugify(data.name || data.email, { lower: true, strict: true });
    let uniqueSlug = baseSlug;
    let count = 1;

    // Check if user with same email exists
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Check for existing slug and increment if necessary
    while (await this.findBySlug(uniqueSlug)) {
        uniqueSlug = `${baseSlug}-${count}`;
        count++;
    }

    // Hash password if provided
    const hashedPassword = data.password ? await argon2.hash(data.password) : undefined;

    return this.prisma.user.create({
      data: {
        ...data,
        ...(hashedPassword && { password: hashedPassword }),
        slug: uniqueSlug,
      },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        password: false, // Explicitly exclude password
      },
    });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    // Check if user exists
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If updating email, check for duplicates
    if (data.email && typeof data.email === 'string') {
      const existingByEmail = await this.prisma.user.findFirst({
        where: { 
          email: data.email,
          NOT: { id }
        }
      });
      if (existingByEmail) {
        throw new BadRequestException('Email already in use by another user');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.findById(userId);
    if (!user || !user.password) {
      throw new NotFoundException('User not found');
    }

    const valid = await argon2.verify(user.password, oldPass);
    if (!valid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedPassword = await argon2.hash(newPass);
    return this.update(userId, { password: hashedPassword });
  }

  async delete(id: string): Promise<User> {
    // Check if user exists
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      return await this.prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      // Handle foreign key constraint errors
      if (error.code === 'P2003' || error.code === 'P2014') {
        throw new BadRequestException('Cannot delete user with existing posts or other related data. Please reassign or delete related data first.');
      }
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<UserWithPosts | null> {
    return this.prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        role: true,
        isActive: true,
        createdPosts: true,
        password: false, // Explicitly exclude password
      },
    });
  }

  async findAllAuthors(): Promise<AuthorInfo[]> {
    // Return users who can author posts (AUTHOR or EDITOR roles)
    return this.prisma.user.findMany({
      where: { 
        OR: [
          { role: 'AUTHOR' },
          { role: 'EDITOR' }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        slug: true,
        role: true,
      }
    });
  }

  async findByName(name: string): Promise<User | null> {
      return this.prisma.user.findFirst({
          where: { name },
      });
  }
}
