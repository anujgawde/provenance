import { Module } from '@nestjs/common';
import { CaptureService } from './capture.service';
import { LineageService } from './lineage.service';
import { UpstreamService } from './upstream.service';
import { LineageController } from './lineage.controller';

@Module({
  controllers: [LineageController],
  providers: [CaptureService, LineageService, UpstreamService],
  exports: [CaptureService, LineageService, UpstreamService],
})
export class CaptureModule {}
