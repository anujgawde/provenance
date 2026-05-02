import { Module } from '@nestjs/common';
import { CaptureService } from './capture.service';
import { UpstreamService } from './upstream.service';

@Module({
  providers: [CaptureService, UpstreamService],
  exports: [CaptureService, UpstreamService],
})
export class CaptureModule {}
