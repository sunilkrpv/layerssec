import { Module } from '@nestjs/common';
import { ThreatController } from './threat.controller';
import { ThreatService } from './threat.service';
import { ReportService } from './report.service';

@Module({
  controllers: [ThreatController],
  providers: [ThreatService, ReportService],
  exports: [ThreatService],
})
export class ThreatModule {}
