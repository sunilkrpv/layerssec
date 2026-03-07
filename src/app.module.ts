import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { ChatModule } from './chat/chat.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    PrismaModule,
    RagModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    DiagramsModule,
    AiModule,
    StorageModule,
    ChatModule,
  ],
})
export class AppModule {}
