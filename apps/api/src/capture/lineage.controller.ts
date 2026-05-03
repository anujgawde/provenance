import { Controller, Get, Param } from '@nestjs/common';
import { CaptureService } from './capture.service';

@Controller('projects')
export class LineageController {
  constructor(private readonly capture: CaptureService) {}

  @Get(':projectId/lineage/:nodeId')
  getLineage(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return { generations: this.capture.getGenerations(projectId, nodeId) };
  }
}
