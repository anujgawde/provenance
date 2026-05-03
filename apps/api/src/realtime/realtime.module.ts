import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CaptureModule } from '../capture/capture.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [CaptureModule, AiModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
