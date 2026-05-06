import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { ChatModule } from '../chat/chat.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import {
  THREAT_ANALYSIS_QUEUE,
  POSTURE_SCORE_QUEUE,
  ATTACK_SIM_QUEUE,
} from '../jobs/queues';

@Module({
  imports: [
    ChatModule,
    UserSettingsModule,
    OnboardingModule,
    // Register queues as producers so AiService can enqueue async jobs.
    // No JobsModule import needed — avoids circular dependency with processors.
    BullModule.registerQueue(
      { name: THREAT_ANALYSIS_QUEUE },
      { name: POSTURE_SCORE_QUEUE },
      { name: ATTACK_SIM_QUEUE },
    ),
  ],
  controllers: [AiController],
  providers: [LlmService, AiService],
  exports: [AiService, LlmService],
})
export class AiModule {}
