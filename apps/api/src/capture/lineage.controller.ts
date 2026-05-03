import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { CaptureService } from './capture.service';
import { LineageService } from './lineage.service';

@Controller('projects')
export class LineageController {
  constructor(
    private readonly capture: CaptureService,
    private readonly lineage: LineageService,
  ) {}

  // Legacy: per-op generation list (kept for backwards compat)
  @Get(':projectId/lineage/:nodeId')
  getLineage(
    @Param('projectId') projectId: string,
    @Param('nodeId') nodeId: string,
  ) {
    return { generations: this.capture.getGenerations(projectId, nodeId) };
  }

  // Legacy: per-op workflow snapshot
  @Get(':projectId/lineage-entry/:entryId/snapshot')
  getSnapshot(
    @Param('projectId') projectId: string,
    @Param('entryId') entryId: string,
  ) {
    const workflow = this.capture.getWorkflowSnapshot(projectId, entryId);
    if (!workflow) throw new NotFoundException('snapshot not found for entry');
    return { workflow };
  }

  // Bit 6: lineage records (upstream subgraph snapshots from generation)
  @Get(':projectId/lineages/:outputNodeId')
  getLineages(
    @Param('projectId') projectId: string,
    @Param('outputNodeId') outputNodeId: string,
  ) {
    return { lineages: this.lineage.getByOutputNode(projectId, outputNodeId) };
  }

  @Get(':projectId/lineage-record/:lineageId')
  getLineageRecord(
    @Param('projectId') projectId: string,
    @Param('lineageId') lineageId: string,
  ) {
    const record = this.lineage.getById(projectId, lineageId);
    if (!record) throw new NotFoundException('lineage record not found');
    return record;
  }
}
