// import { Body, Controller, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import { AuthService } from './auth.service';
// import { LocalAuthGuard } from './guard/local-auth.guard';

// @Controller('auth')
// export class AuthController {
//   constructor(private authService: AuthService) {}

//   @UseGuards(LocalAuthGuard)
//   @Post('login')
//   @HttpCode(HttpStatus.OK)
//   async login(@Request() req) {
//     return this.authService.login(req.user);
//   }

//   @Post('register')
//   async register(@Body() body) {
//     return this.authService.register(body);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Post('logout')
//   @HttpCode(HttpStatus.OK)
//   async logout(@Request() req) {
//     return this.authService.logout(req.user['sub']);
//   }

//   @UseGuards(JwtAuthGuard)
//   @Post('refresh')
//   @HttpCode(HttpStatus.OK)
//   async refresh(@Body() body) {
//     return this.authService.refreshTokens(body.userId, body.refreshToken); 
//   }
// }

import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { LocalAuthGuard } from './guard/local-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req, @Headers('authorization') authHeader: string) {
    if (!authHeader) {
      throw new UnauthorizedException('No token provided');
    }
    
    // Extract token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    
    // Get userId from JWT payload (populated by JwtAuthGuard)
    return this.authService.logout(req.user.id, token);
  }

  // Removed JWT guard - refresh endpoint should work with expired access tokens
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken); 
  }
}