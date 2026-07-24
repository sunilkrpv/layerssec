import { BadRequestException, Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSettingsService } from './user-settings.service';
import { AiModelsService } from './ai-models.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(
    private readonly userSettings: UserSettingsService,
    private readonly aiModels: AiModelsService,
  ) {}

  @Get('ai-settings')
  getAiSettings(@CurrentUser('id') userId: string) {
    return this.userSettings.getAiSettings(userId);
  }

  @Put('ai-settings')
  updateAiSettings(@CurrentUser('id') userId: string, @Body() dto: UpdateAiSettingsDto) {
    return this.userSettings.updateAiSettings(userId, dto);
  }

  @Get('ai-metrics')
  getTokenMetrics(@CurrentUser('id') userId: string) {
    return this.userSettings.getTokenMetrics(userId);
  }

  @Get('ai-models')
  getAiModels(@CurrentUser('id') userId: string, @Query('provider') provider?: string) {
    const normalized = (provider ?? '').toUpperCase();
    if (!Object.values(AiProvider).includes(normalized as AiProvider)) {
      throw new BadRequestException('Invalid or missing provider');
    }
    return this.aiModels.listModels(userId, normalized as AiProvider);
  }
}
