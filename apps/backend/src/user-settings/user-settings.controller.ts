import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserSettingsService } from './user-settings.service';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserSettingsController {
  constructor(private readonly userSettings: UserSettingsService) {}

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
}
