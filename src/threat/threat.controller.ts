import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThreatService } from './threat.service';
import { ReportService } from './report.service';
import { SaveThreatModelDto } from './dto/save-threat-model.dto';
import { UpdateThreatDto } from './dto/update-threat.dto';
import { CreateThreatDto } from './dto/create-threat.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ThreatController {
  constructor(
    private readonly threat: ThreatService,
    private readonly report: ReportService,
  ) {}

  // POST /api/projects/:projectId/threat-models
  @Post('projects/:projectId/threat-models')
  @HttpCode(HttpStatus.CREATED)
  save(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveThreatModelDto,
  ) {
    return this.threat.saveThreatModel(projectId, userId, dto);
  }

  // GET /api/projects/:projectId/threat-models
  @Get('projects/:projectId/threat-models')
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threat.listThreatModels(projectId, userId);
  }

  // GET /api/projects/:projectId/threats/report  — PDF export
  @Get('projects/:projectId/threats/report')
  async exportReport(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.report.generateProjectReport(projectId, userId);
    const filename = `threat-report-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // GET /api/projects/:projectId/threats  — paginated + filtered threats dashboard
  @Get('projects/:projectId/threats')
  listProjectThreats(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('strideCategory') strideCategory?: string,
  ) {
    return this.threat.listProjectThreats(projectId, userId, {
      page: page ? parseInt(page, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 10,
      search,
      severity,
      status,
      strideCategory,
    });
  }

  // GET /api/threat-models/:threatModelId
  @Get('threat-models/:threatModelId')
  findOne(
    @Param('threatModelId', ParseUUIDPipe) threatModelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threat.getThreatModel(threatModelId, userId);
  }

  // DELETE /api/threat-models/:threatModelId
  @Delete('threat-models/:threatModelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteThreatModel(
    @Param('threatModelId', ParseUUIDPipe) threatModelId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threat.deleteThreatModel(threatModelId, userId);
  }

  // POST /api/threat-models/:threatModelId/threats  — user-created threat
  @Post('threat-models/:threatModelId/threats')
  @HttpCode(HttpStatus.CREATED)
  createThreat(
    @Param('threatModelId', ParseUUIDPipe) threatModelId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateThreatDto,
  ) {
    return this.threat.createThreat(threatModelId, userId, dto);
  }

  // PATCH /api/threat-models/:threatModelId/threats/:threatId
  @Patch('threat-models/:threatModelId/threats/:threatId')
  updateThreat(
    @Param('threatModelId', ParseUUIDPipe) threatModelId: string,
    @Param('threatId', ParseUUIDPipe) threatId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateThreatDto,
  ) {
    return this.threat.updateThreat(threatModelId, threatId, userId, dto);
  }

  // DELETE /api/threat-models/:threatModelId/threats/:threatId
  @Delete('threat-models/:threatModelId/threats/:threatId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteThreat(
    @Param('threatModelId', ParseUUIDPipe) threatModelId: string,
    @Param('threatId', ParseUUIDPipe) threatId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.threat.deleteThreat(threatModelId, threatId, userId);
  }
}
