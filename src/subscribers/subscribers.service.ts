import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscribersService {
  constructor(private prisma: PrismaService) {}

  async subscribe(email: string) {
    const exists = await this.prisma.subscriber.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email already subscribed');
    return this.prisma.subscriber.create({ data: { email } });
  }

  async unsubscribe(email: string) {
    const subscriber = await this.prisma.subscriber.findUnique({ where: { email } });
    if (!subscriber) throw new NotFoundException('Subscriber not found');
    return this.prisma.subscriber.delete({ where: { email } });
  }

  async findAll() {
      return this.prisma.subscriber.findMany();
  }
}
