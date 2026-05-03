import { Module } from '@nestjs/common';
import { CaptureService } from './capture.service';
import { UpstreamService } from './upstream.service';
import { LineageController } from './lineage.controller';

@Module({
  controllers: [LineageController],
  providers: [CaptureService, UpstreamService],
  exports: [CaptureService, UpstreamService],
})
export class CaptureModule {}
