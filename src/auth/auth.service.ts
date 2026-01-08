import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  // Helper to validate user
  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await argon2.verify(user.password, pass))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const tokens = await this.generateTokens(user.id, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return {
      user,
      ...tokens,
    };
  }

  async register(data: any) {
    const exists = await this.usersService.findByEmail(data.email);
    if (exists) throw new ConflictException('Email already exists');

    const hashedPassword = await argon2.hash(data.password);
    
    const user = await this.usersService.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: Role.EDITOR,
    });

    const tokens = await this.generateTokens(user.id, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return {
      user,
      ...tokens,
    };
  }

  async createUser(data: any) {
    const exists = await this.usersService.findByEmail(data.email);
    if (exists) throw new ConflictException('Email already exists');

    const hashedPassword = await argon2.hash(data.password);
    
    const user = await this.usersService.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      role: data.role,
    });

    const tokens = await this.generateTokens(user.id, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);
    return {
      user,
      ...tokens,
    };
  }

  async logout(userId: string, accessToken: string) {
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

    return { message: 'Logged out successfully' }; 
  }

  async refreshTokens(refreshToken: string) {
    // Find all non-revoked, non-expired tokens for comparison
    const tokenRecords = await this.prisma.refreshToken.findMany({
      where: {
        revoked: false,
        expiresAt: { gt: new Date() }
      }
    });

    // Verify the token by comparing hashes
    let validTokenRecord: typeof tokenRecords[number] | null = null;
    for (const record of tokenRecords) {
      const isValid = await argon2.verify(record.tokenHash, refreshToken);
      if (isValid) {
        validTokenRecord = record;
        break;
      }
    }

    if (!validTokenRecord) {
      throw new UnauthorizedException('Invalid Refresh Token');
    }

    const user = await this.usersService.findById(validTokenRecord.userId);
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(user.id, user.role);
    
    // Rotate refresh token - revoke the old one
    await this.prisma.refreshToken.update({ 
      where: { id: validTokenRecord.id }, 
      data: { revoked: true } 
    });
    
    // Create new refresh token
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async generateTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    const expiresIn = '15m';
    const accessToken = this.jwtService.sign(payload, { expiresIn });
    const refreshToken = uuidv4();
    
    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const MAX_SESSIONS = 5;

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
  }

  // Check if a token is blacklisted
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklisted = await this.prisma.blacklistedToken.findUnique({
      where: { token },
    });
    return !!blacklisted;
  }

  // Cleanup expired blacklisted tokens (run this periodically)
  async cleanupBlacklistedTokens() {
    await this.prisma.blacklistedToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}