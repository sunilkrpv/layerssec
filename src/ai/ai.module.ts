import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  controllers: [AiController],
  providers: [LlmService, AiService],
  exports: [AiService, LlmService],
})
export class AiModule {}
