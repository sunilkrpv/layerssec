import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // Must come before :id routes to avoid 'activity' being treated as a job ID
  @Get('activity')
  listActivity(
    @CurrentUser('id') userId: string,
    @Query('types') types?: string,
    @Query('statuses') statuses?: string,
    @Query('dateRange') dateRange?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.jobsService.listActivity(userId, {
      types: types ? types.split(',').filter(Boolean) : undefined,
      statuses: statuses ? statuses.split(',').filter(Boolean) : undefined,
      dateRange,
      search,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get()
  list(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.jobsService.listForUser(userId, projectId);
  }

  @Get(':id/status')
  getStatus(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobsService.getStatus(id, userId);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.jobsService.cancel(id, userId);
  }
}
