import { Module } from '@nestjs/common';
import { ThreatController } from './threat.controller';
import { ThreatService } from './threat.service';
import { ReportService } from './report.service';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [OnboardingModule],
  controllers: [ThreatController],
  providers: [ThreatService, ReportService],
  exports: [ThreatService],
})
export class ThreatModule {}
