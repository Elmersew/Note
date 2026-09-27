import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { EventsModule } from './events/events.module';
import { NotesModule } from './notes/notes.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { SyncModule } from './sync/sync.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    AuthModule,
    RealtimeModule,
    NotesModule,
    TasksModule,
    EventsModule,
    SyncModule,
    AiModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
