import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotesController, SharesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [AuthModule, RealtimeModule],
  controllers: [NotesController, SharesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
