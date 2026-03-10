import { Module } from '@nestjs/common';
import { ThreatController } from './threat.controller';
import { ThreatService } from './threat.service';

@Module({
  controllers: [ThreatController],
  providers: [ThreatService],
  exports: [ThreatService],
})
export class ThreatModule {}
