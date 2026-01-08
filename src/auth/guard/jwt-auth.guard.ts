// import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { AuthService } from '../auth.service';

// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {
//   constructor(private authService: AuthService) {
//     super();
//   }

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     // First, let Passport validate the JWT
//     const canActivate = await super.canActivate(context);
    
//     if (!canActivate) {
//       return false;
//     }

//     // Extract token from request
//     const request = context.switchToHttp().getRequest();
//     const authHeader = request.headers.authorization;
    
//     if (!authHeader) {
//       throw new UnauthorizedException('No token provided');
//     }

//     const token = authHeader.replace('Bearer ', '');

//     // Check if token is blacklisted
//     const isBlacklisted = await this.authService.isTokenBlacklisted(token);
    
//     if (isBlacklisted) {
//       throw new UnauthorizedException('Token has been revoked');
//     }

//     return true;
//   }
// }

import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const isBlacklisted = await this.authService.isTokenBlacklisted(token);

    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return true;
  }
}