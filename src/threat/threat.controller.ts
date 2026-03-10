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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ThreatService } from './threat.service';
import { SaveThreatModelDto } from './dto/save-threat-model.dto';
import { UpdateThreatDto } from './dto/update-threat.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ThreatController {
  constructor(private readonly threat: ThreatService) {}

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
