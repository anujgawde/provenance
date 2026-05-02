import { Module } from '@nestjs/common';
import { CaptureModule } from '../capture/capture.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [CaptureModule],
  providers: [RealtimeGateway],
})
export class RealtimeModule {}
