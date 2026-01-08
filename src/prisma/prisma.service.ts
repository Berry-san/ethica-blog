import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  currentUser: { id: string } | null;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

  async onModuleInit() {
    await this.$connect();

    // Audit middleware
    this.$use(async (params, next) => {
      if (params.model === 'Post') {
        const store = this.asyncLocalStorage.getStore();
        const userId = store?.currentUser?.id;

        if (params.action === 'create' && userId) {
          if (params.args.data) {
            params.args.data.createdById = userId;
            params.args.data.updatedById = userId;
          }
        }

        if (params.action === 'update' && userId) {
          if (params.args.data) {
            params.args.data.updatedById = userId;
          }
        }
      }

      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  runWithContext<T>(
    user: { id: string } | null,
    callback: () => Promise<T>,
  ): Promise<T> {
    return this.asyncLocalStorage.run({ currentUser: user }, callback);
  }
}
