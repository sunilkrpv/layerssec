import { Module } from '@nestjs/common';
import { ThreatController } from './threat.controller';
import { ThreatService } from './threat.service';
import { ReportService } from './report.service';
import { PostureRollupService } from './posture-rollup.service';
import { IntelReportService } from './intel-report.service';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [OnboardingModule, AiModule],
  controllers: [ThreatController],
  providers: [ThreatService, ReportService, PostureRollupService, IntelReportService],
  exports: [ThreatService, PostureRollupService, IntelReportService],
})
export class ThreatModule {}
