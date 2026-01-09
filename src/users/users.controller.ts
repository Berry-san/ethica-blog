import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guard/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guard/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';


@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPER_ADMIN)
  async create(@Body() createUserDto: CreateUserDto) {
    // Prevent creation of SUPER_ADMIN via API
    if (createUserDto.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('Cannot create SUPER_ADMIN via API');
    }
    
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('authors')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.EDITOR) // Editors/Admins can see list
  findAllAuthors() {
    return this.usersService.findAllAuthors();
  }

  @Get(':slug')
  findOneBySlug(@Param('slug') slug: string) {
    return this.usersService.findBySlug(slug);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN) // Admin can view any user
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() updateUserDto: Prisma.UserUpdateInput) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deactivate(@Param('id') id: string) {
      return this.usersService.update(id, { isActive: false });
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  activate(@Param('id') id: string) {
      return this.usersService.update(id, { isActive: true });
  }
}
