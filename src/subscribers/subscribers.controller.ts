import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { RolesGuard } from '../auth/guard/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { SubscribersService } from './subscribers.service';

@ApiTags('subscribers')
@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  subscribe(@Body() createSubscriberDto: CreateSubscriberDto) {
    return this.subscribersService.subscribe(createSubscriberDto.email);
  }

  @Delete(':email')
  unsubscribe(@Param('email') email: string) {
    return this.subscribersService.unsubscribe(email);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  findAll() {
      return this.subscribersService.findAll();
  }
}
