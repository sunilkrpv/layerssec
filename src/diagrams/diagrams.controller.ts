import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, ParseUUIDPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';
import { PublishDiagramDto } from './dto/publish-diagram.dto';
import { CheckoutDto } from './dto/checkout.dto';

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

  // ── Versioning endpoints ─────────────────────────────────────────────────

  /** Freeze the current draft as a published version */
  @Post('diagrams/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PublishDiagramDto,
  ) {
    return this.diagrams.publish(id, userId, dto);
  }

  /** List all versions (draft + published) for a project, newest-first */
  @Get('projects/:projectId/versions')
  listVersions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.diagrams.listVersions(projectId, userId);
  }

  /** Get the current draft for a project (null if none) */
  @Get('projects/:projectId/draft')
  getDraft(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.diagrams.getDraft(projectId, userId);
  }

  /** Create a new draft from a published version (409 if draft already exists) */
  @Post('projects/:projectId/checkout')
  checkout(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CheckoutDto,
  ) {
    return this.diagrams.checkout(projectId, userId, dto);
  }
}
