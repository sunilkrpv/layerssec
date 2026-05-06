import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.projects.findAllByUser(userId);
  }

  @Get('summary')
  getSummary(@CurrentUser('id') userId: string) {
    return this.projects.getSummary(userId);
  }

  @Get(':id/overview')
  getOverview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.getOverview(id, userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.findById(id, userId);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(id, userId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.projects.remove(id, userId);
  }
}
