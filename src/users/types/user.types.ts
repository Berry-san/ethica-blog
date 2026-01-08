import { User } from '@prisma/client';

/**
 * User entity without sensitive password field
 * Use this type for all public-facing user data
 */
export type SafeUser = Omit<User, 'password'>;

/**
 * User with related posts
 * Used when fetching user by slug with their authored posts
 */
export type UserWithPosts = Omit<User, 'password' | 'createdAt' | 'updatedAt' | 'createdById'> & {
  createdPosts: any[];
};

/**
 * Minimal user info for author listings
 */
export type AuthorInfo = Pick<User, 'id' | 'name' | 'email' | 'slug' | 'role'>;
