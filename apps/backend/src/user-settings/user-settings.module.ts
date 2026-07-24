import { Module } from '@nestjs/common';
import { UserSettingsController } from './user-settings.controller';
import { UserSettingsService } from './user-settings.service';
import { AiModelsService } from './ai-models.service';

@Module({
  controllers: [UserSettingsController],
  providers: [UserSettingsService, AiModelsService],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
