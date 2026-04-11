import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { DiagramsModule } from './diagrams/diagrams.module';
import { AiModule } from './ai/ai.module';
import { ChatModule } from './chat/chat.module';
import { RagModule } from './rag/rag.module';
import { ThreatModule } from './threat/threat.module';
import { UserSettingsModule } from './user-settings/user-settings.module';
import { EncryptionModule } from './encryption/encryption.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    // BullMQ — global Redis connection; all queues share this connection
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    EncryptionModule,
    PrismaModule,
    RagModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    DiagramsModule,
    AiModule,
    ChatModule,
    ThreatModule,
    UserSettingsModule,
    JobsModule,
  ],
})
export class AppModule {}
