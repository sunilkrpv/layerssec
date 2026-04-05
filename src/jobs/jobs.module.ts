import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ThreatModule } from '../threat/threat.module';
import { UserSettingsModule } from '../user-settings/user-settings.module';
import { AiModule } from '../ai/ai.module';
import { ThreatAnalysisProcessor } from './processors/threat-analysis.processor';
import { PostureScoreProcessor } from './processors/posture-score.processor';
import { AttackSimulationProcessor } from './processors/attack-simulation.processor';
import {
  THREAT_ANALYSIS_QUEUE,
  POSTURE_SCORE_QUEUE,
  ATTACK_SIM_QUEUE,
} from './queues';

@Module({
  imports: [
    PrismaModule,
    UserSettingsModule,
    ThreatModule,
    // forwardRef breaks the AiModule ↔ JobsModule circular dependency.
    // AiModule imports BullModule.registerQueue directly (no JobsModule dep).
    // JobsModule imports AiModule only to access LlmService for processors.
    forwardRef(() => AiModule),
    BullModule.registerQueue(
      { name: THREAT_ANALYSIS_QUEUE },
      { name: POSTURE_SCORE_QUEUE },
      { name: ATTACK_SIM_QUEUE },
    ),
  ],
  controllers: [JobsController],
  providers: [JobsService, ThreatAnalysisProcessor, PostureScoreProcessor, AttackSimulationProcessor],
  exports: [BullModule, JobsService],
})
export class JobsModule {}
