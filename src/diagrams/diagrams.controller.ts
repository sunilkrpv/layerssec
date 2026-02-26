import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class DiagramsController {
  constructor(private diagrams: DiagramsService) {}

  @Post('projects/:projectId/diagrams')
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDiagramDto,
  ) {
    return this.diagrams.create(projectId, userId, dto);
  }

  @Get('diagrams/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.diagrams.findById(id, userId);
  }

  @Patch('diagrams/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateDiagramDto,
  ) {
    return this.diagrams.update(id, userId, dto);
  }

  @Delete('diagrams/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.diagrams.remove(id, userId);
  }
}
