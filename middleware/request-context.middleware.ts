// src/middleware/request-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { User } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';

interface AuthenticatedRequest extends Request {
  user?: User;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private prismaService: PrismaService) {}

  use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const user = req.user || null;
    this.prismaService.runWithContext(user, async () => next());
  }
}
