import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
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

  @Get(':projectId/lineage-entry/:entryId/snapshot')
  getSnapshot(
    @Param('projectId') projectId: string,
    @Param('entryId') entryId: string,
  ) {
    const workflow = this.capture.getWorkflowSnapshot(projectId, entryId);
    if (!workflow) throw new NotFoundException('snapshot not found for entry');
    return { workflow };
  }
}
