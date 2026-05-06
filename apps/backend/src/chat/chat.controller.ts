import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { SaveChatMessagesDto } from './dto/save-chat-messages.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('projects/:projectId/chat/messages')
  getHistory(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chat.getHistory(projectId, userId);
  }

  @Post('projects/:projectId/chat/messages')
  @HttpCode(HttpStatus.OK)
  saveMessages(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveChatMessagesDto,
  ) {
    return this.chat.saveMessages(projectId, userId, dto.messages);
  }
}
