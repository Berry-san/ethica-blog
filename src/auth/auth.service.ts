// import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { Role } from '@prisma/client';
// import * as argon2 from 'argon2';
// import { v4 as uuidv4 } from 'uuid';
// import { PrismaService } from '../prisma/prisma.service';
// import { UsersService } from '../users/users.service';

// @Injectable()
// export class AuthService {
//   private readonly logger = new Logger(AuthService.name);
//   constructor(
//     private jwtService: JwtService,
//     private usersService: UsersService,
//     private prisma: PrismaService,
//   ) {}

//   // Helper to validate user
//   async validateUser(email: string, pass: string): Promise<any> {
//     this.logger.log(`Login attempt for: ${email}`);
//     const user = await this.usersService.findByEmail(email);
//     if (user && (await argon2.verify(user.password, pass))) {
//       this.logger.log(`User authenticated successfully: ${email}`);
//       const { password, ...result } = user;
//       return result;
//     }
//     this.logger.warn(`Invalid credentials for: ${email}`);
//     return null;
//   }

//   async login(user: any) {
//     this.logger.log(`Generating tokens for user: ${user.id}`);
//     const tokens = await this.generateTokens(user.id, user.role);
//     await this.updateRefreshToken(user.id, tokens.refreshToken);
//     return {
//       user,
//       ...tokens,
//     };
//   }

//   async register(data: any) {
//     this.logger.log(`Registration attempt for: ${data.email}`);
//     const exists = await this.usersService.findByEmail(data.email);
//     if (exists) {
//       this.logger.warn(`Registration failed - email already exists: ${data.email}`);
//       throw new ConflictException('Email already exists');
//     }

//     const hashedPassword = await argon2.hash(data.password);
    
//     const user = await this.usersService.create({
//       email: data.email,
//       password: hashedPassword,
//       name: data.name,
//       role: Role.EDITOR,
//     });
    
//     this.logger.log(`User registered successfully: ${user.email}`);

//     const tokens = await this.generateTokens(user.id, user.role);
//     await this.updateRefreshToken(user.id, tokens.refreshToken);
//     return {
//       user,
//       ...tokens,
//     };
//   }

//   async createUser(data: any) {
//     const exists = await this.usersService.findByEmail(data.email);
//     if (exists) throw new ConflictException('Email already exists');

//     const hashedPassword = await argon2.hash(data.password);
    
//     const user = await this.usersService.create({
//       email: data.email,
//       password: hashedPassword,
//       name: data.name,
//       role: data.role,
//     });

//     const tokens = await this.generateTokens(user.id, user.role);
//     await this.updateRefreshToken(user.id, tokens.refreshToken);
//     return {
//       user,
//       ...tokens,
//     };
//   }

//   async logout(userId: string, accessToken: string) {
//     this.logger.log(`Logout initiated for user: ${userId}`);
//     // 1. Revoke all refresh tokens for this user
//     await this.prisma.refreshToken.updateMany({
//       where: { userId },
//       data: { revoked: true }
//     });

//     // 2. Blacklist the current access token
//     const decoded = this.jwtService.decode(accessToken) as any;
//     if (decoded && decoded.exp) {
//       const expiresAt = new Date(decoded.exp * 1000);
//       await this.prisma.blacklistedToken.create({
//         data: {
//           token: accessToken,
//           userId: userId,
//           expiresAt: expiresAt,
//         },
//       });
//     }

//     return { message: 'Logged out successfully' };
//   }

//   async refreshTokens(refreshToken: string) {
//     this.logger.log('Refresh token request received');
//     // Find all non-revoked, non-expired tokens for comparison
//     const tokenRecords = await this.prisma.refreshToken.findMany({
//       where: {
//         revoked: false,
//         expiresAt: { gt: new Date() }
//       }
//     });

//     // Verify the token by comparing hashes
//     let validTokenRecord: typeof tokenRecords[number] | null = null;
//     for (const record of tokenRecords) {
//       const isValid = await argon2.verify(record.tokenHash, refreshToken);
//       if (isValid) {
//         validTokenRecord = record;
//         break;
//       }
//     }

//     if (!validTokenRecord) {
//       this.logger.warn('Invalid refresh token attempt');
//       throw new UnauthorizedException('Invalid Refresh Token');
//     }
    
//     this.logger.log(`Refresh token validated for user: ${validTokenRecord.userId}`);

//     const user = await this.usersService.findById(validTokenRecord.userId);
//     if (!user) throw new UnauthorizedException('User not found');

//     const tokens = await this.generateTokens(user.id, user.role);
    
//     // Rotate refresh token - revoke the old one
//     await this.prisma.refreshToken.update({
//       where: { id: validTokenRecord.id },
//       data: { revoked: true }
//     });
    
//     // Create new refresh token
//     await this.updateRefreshToken(user.id, tokens.refreshToken);

//     return tokens;
//   }

//   async generateTokens(userId: string, role: string) {
//     const payload = { sub: userId, role };
//     const expiresIn = '15m';
//     const accessToken = this.jwtService.sign(payload, { expiresIn });
//     const refreshToken = uuidv4();
    
//     return {
//       accessToken,
//       refreshToken,
//       expiresIn: 15 * 60, // 15 minutes in seconds
//     };
//   }

//   async updateRefreshToken(userId: string, refreshToken: string) {
//     const MAX_SESSIONS = 5;

//     // Hash the refresh token before storing
//     const hashedToken = await argon2.hash(refreshToken);

//     // 1. Cleanup expired tokens or revoked tokens
//     await this.prisma.refreshToken.deleteMany({
//       where: {
//         userId,
//         OR: [
//           { expiresAt: { lt: new Date() } },
//           { revoked: true }
//         ]
//       },
//     });

//     // 2. Check active sessions count
//     const activeTokensCount = await this.prisma.refreshToken.count({
//       where: { userId },
//     });

//     // 3. If limit reached, delete oldest
//     if (activeTokensCount >= MAX_SESSIONS) {
//       const oldestToken = await this.prisma.refreshToken.findFirst({
//         where: { userId },
//         orderBy: { createdAt: 'asc' },
//       });

//       if (oldestToken) {
//         await this.prisma.refreshToken.delete({
//           where: { id: oldestToken.id },
//         });
//       }
//     }

//     const expiryDate = new Date();
//     expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

//     // Store the hashed token, not the plain token
//     await this.prisma.refreshToken.create({
//       data: {
//         tokenHash: hashedToken,
//         userId: userId,
//         expiresAt: expiryDate,
//       },
//     });
//   }

//   // Check if a token is blacklisted
//   async isTokenBlacklisted(token: string): Promise<boolean> {
//     const blacklisted = await this.prisma.blacklistedToken.findUnique({
//       where: { token },
//     });
//     return !!blacklisted;
//   }

//   // Cleanup expired blacklisted tokens (run this periodically)
//   async cleanupBlacklistedTokens() {
//     await this.prisma.blacklistedToken.deleteMany({
//       where: {
//         expiresAt: { lt: new Date() },
//       },
//     });
//   }
// }


import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  /**
   * Validates user credentials with detailed error tracking
   * @param email - User email
   * @param pass - Plain text password
   * @returns User object without password if valid, null otherwise
   */
  async validateUser(email: string, pass: string): Promise<any> {
    // Input validation
    if (!email || !pass) {
      this.logger.warn('Validation failed: Missing email or password');
      return null;
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    this.logger.log(`Login attempt for: ${normalizedEmail}`);

    try {
      // Find user
      const user = await this.usersService.findByEmail(normalizedEmail);
      
      if (!user) {
        this.logger.warn(`User not found in database: ${normalizedEmail}`);
        // Don't reveal whether user exists (security best practice)
        return null;
      }

      // Check if user has a password set
      if (!user.password) {
        this.logger.error(`User ${normalizedEmail} has no password set in database`);
        return null;
      }

      this.logger.debug(`User found, verifying password for: ${normalizedEmail}`);

      // Verify password with argon2
      let isPasswordValid = false;
      try {
        isPasswordValid = await argon2.verify(user.password, pass);
      } catch (verifyError) {
        this.logger.error(`Argon2 verification error for ${normalizedEmail}:`, verifyError.message);
        return null;
      }

      if (!isPasswordValid) {
        this.logger.warn(`Invalid password attempt for: ${normalizedEmail}`);
        return null;
      }

      // Password is valid
      this.logger.log(`User authenticated successfully: ${normalizedEmail}`);
      
      // Return user without password
      const { password, ...result } = user;
      return result;

    } catch (error) {
      this.logger.error(`Unexpected error during validation for ${normalizedEmail}:`, {
        message: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  async login(user: any) {
    if (!user || !user.id) {
      this.logger.error('Login failed: Invalid user object');
      throw new UnauthorizedException('Invalid user data');
    }

    this.logger.log(`Generating tokens for user: ${user.id}`);
    
    try {
      const tokens = await this.generateTokens(user.id, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
      
      return {
        user,
        ...tokens,
      };
    } catch (error) {
      this.logger.error(`Token generation failed for user ${user.id}:`, error.message);
      throw new UnauthorizedException('Failed to generate authentication tokens');
    }
  }

  async register(data: any) {
    // Validate input
    if (!data.email || !data.password || !data.name) {
      throw new BadRequestException('Email, password, and name are required');
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    this.logger.log(`Registration attempt for: ${normalizedEmail}`);

    // Check if user exists
    const exists = await this.usersService.findByEmail(normalizedEmail);
    if (exists) {
      this.logger.warn(`Registration failed - email already exists: ${normalizedEmail}`);
      throw new ConflictException('Email already exists');
    }

    // Validate password strength
    if (data.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    try {
      // Hash password
      const hashedPassword = await argon2.hash(data.password);
      
      // Create user
      const user = await this.usersService.create({
        email: normalizedEmail,
        password: hashedPassword,
        name: data.name.trim(),
        role: Role.EDITOR,
      });
      
      this.logger.log(`User registered successfully: ${user.email}`);

      // Generate tokens
      const tokens = await this.generateTokens(user.id, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
      
      // Remove password from response
      // const { password, ...userWithoutPassword } = user;
      
      return {
        user,
        ...tokens,
      };
    } catch (error) {
      this.logger.error(`Registration failed for ${normalizedEmail}:`, error.message);
      throw new BadRequestException('Registration failed');
    }
  }

  async createUser(data: any) {
    // Validate input
    if (!data.email || !data.password || !data.name || !data.role) {
      throw new BadRequestException('Email, password, name, and role are required');
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    
    const exists = await this.usersService.findByEmail(normalizedEmail);
    if (exists) {
      throw new ConflictException('Email already exists');
    }

    // Validate role
    if (!Object.values(Role).includes(data.role)) {
      throw new BadRequestException('Invalid role');
    }

    try {
      const hashedPassword = await argon2.hash(data.password);
      
      const user = await this.usersService.create({
        email: normalizedEmail,
        password: hashedPassword,
        name: data.name.trim(),
        role: data.role,
      });

      const tokens = await this.generateTokens(user.id, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);
      
      // const { password, ...userWithoutPassword } = user;
      
      return {
        user,
        ...tokens,
      };
    } catch (error) {
      this.logger.error(`User creation failed:`, error.message);
      throw new BadRequestException('Failed to create user');
    }
  }

  async logout(userId: string, accessToken: string) {
    if (!userId || !accessToken) {
      throw new BadRequestException('Invalid logout request');
    }

    this.logger.log(`Logout initiated for user: ${userId}`);
    
    try {
      // 1. Revoke all refresh tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true }
      });

      // 2. Blacklist the current access token
      const decoded = this.jwtService.decode(accessToken) as any;
      if (decoded && decoded.exp) {
        const expiresAt = new Date(decoded.exp * 1000);
        await this.prisma.blacklistedToken.create({
          data: {
            token: accessToken,
            userId: userId,
            expiresAt: expiresAt,
          },
        });
      }

      this.logger.log(`User logged out successfully: ${userId}`);
      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Logout failed for user ${userId}:`, error.message);
      throw new BadRequestException('Logout failed');
    }
  }

  async refreshTokens(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('refreshToken is required');
    }

    this.logger.log('Refresh token request received');
    
    try {
      // Find all non-revoked, non-expired tokens for comparison
      const tokenRecords = await this.prisma.refreshToken.findMany({
        where: {
          revoked: false,
          expiresAt: { gt: new Date() }
        }
      });

      if (tokenRecords.length === 0) {
        this.logger.warn('No valid refresh tokens found in database');
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify the token by comparing hashes
      let validTokenRecord: typeof tokenRecords[number] | null = null;
      for (const record of tokenRecords) {
        try {
          const isValid = await argon2.verify(record.tokenHash, refreshToken);
          if (isValid) {
            validTokenRecord = record;
            break;
          }
        } catch (verifyError) {
          this.logger.debug(`Token verification failed for record ${record.id}`);
          continue;
        }
      }

      if (!validTokenRecord) {
        this.logger.warn('Invalid refresh token attempt - no matching hash found');
        throw new UnauthorizedException('Invalid refresh token');
      }
      
      this.logger.log(`Refresh token validated for user: ${validTokenRecord.userId}`);

      // Get user
      const user = await this.usersService.findById(validTokenRecord.userId);
      if (!user) {
        this.logger.error(`User not found for refresh token: ${validTokenRecord.userId}`);
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.role);
      
      // Rotate refresh token - revoke the old one
      await this.prisma.refreshToken.update({ 
        where: { id: validTokenRecord.id }, 
        data: { revoked: true } 
      });
      
      // Create new refresh token
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      this.logger.log(`New tokens generated for user: ${user.id}`);
      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Refresh token error:', error.message);
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  async generateTokens(userId: string, role: string) {
    if (!userId || !role) {
      throw new BadRequestException('User ID and role are required for token generation');
    }

    const payload = { sub: userId, role };
    const expiresIn = '15m';
    
    try {
      const accessToken = this.jwtService.sign(payload, { expiresIn });
      const refreshToken = uuidv4();
      
      return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15 minutes in seconds
      };
    } catch (error) {
      this.logger.error('Token generation failed:', error.message);
      throw new BadRequestException('Failed to generate tokens');
    }
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const MAX_SESSIONS = 5;

    if (!userId || !refreshToken) {
      throw new BadRequestException('User ID and refresh token are required');
    }

    try {
      // Hash the refresh token before storing
      const hashedToken = await argon2.hash(refreshToken);

      // 1. Cleanup expired tokens or revoked tokens
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
          OR: [
            { expiresAt: { lt: new Date() } },
            { revoked: true }
          ]
        },
      });

      // 2. Check active sessions count
      const activeTokensCount = await this.prisma.refreshToken.count({
        where: { userId },
      });

      // 3. If limit reached, delete oldest
      if (activeTokensCount >= MAX_SESSIONS) {
        const oldestToken = await this.prisma.refreshToken.findFirst({
          where: { userId },
          orderBy: { createdAt: 'asc' },
        });

        if (oldestToken) {
          await this.prisma.refreshToken.delete({
            where: { id: oldestToken.id },
          });
        }
      }

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 7); // 7 days

      // Store the hashed token, not the plain token
      await this.prisma.refreshToken.create({
        data: {
          tokenHash: hashedToken,
          userId: userId,
          expiresAt: expiryDate,
        },
      });

      this.logger.debug(`Refresh token stored for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to update refresh token for user ${userId}:`, error.message);
      throw new BadRequestException('Failed to store refresh token');
    }
  }

  /**
   * Check if an access token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    if (!token) return false;
    
    try {
      const blacklisted = await this.prisma.blacklistedToken.findUnique({
        where: { token },
      });
      return !!blacklisted;
    } catch (error) {
      this.logger.error('Error checking blacklist:', error.message);
      return false;
    }
  }

  /**
   * Cleanup expired blacklisted tokens (run this periodically via cron)
   */
  async cleanupBlacklistedTokens() {
    try {
      const result = await this.prisma.blacklistedToken.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });
      this.logger.log(`Cleaned up ${result.count} expired blacklisted tokens`);
      return result;
    } catch (error) {
      this.logger.error('Failed to cleanup blacklisted tokens:', error.message);
      throw error;
    }
  }
}