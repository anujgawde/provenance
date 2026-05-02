import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Operation, Workflow } from '@provenance/shared';
import { DbService } from '../db/db.service';
import { UpstreamService } from './upstream.service';

export interface LineageEntry {
  id: string;
  projectId: string;
  nodeId: string;
  parentIds: string[];
  opType: Operation['type'];
  snapshot: unknown;
  createdAt: number;
}

@Injectable()
export class CaptureService {
  constructor(
    private readonly db: DbService,
    private readonly upstream: UpstreamService,
  ) {}

  shouldCapture(op: Operation): boolean {
    if (op.type === 'op:node:update') {
      return op.changes.data !== undefined;
    }
    return true;
  }

  capture(projectId: string, workflow: Workflow, op: Operation): LineageEntry | null {
    if (!this.shouldCapture(op)) return null;
    const nodeId = this.nodeIdFor(op);
    if (!nodeId) return null;

    const parentIds = this.parentIdsFor(workflow, op, nodeId);
    const snapshot = this.snapshotFor(workflow, op, nodeId);

    const entry: LineageEntry = {
      id: randomUUID(),
      projectId,
      nodeId,
      parentIds,
      opType: op.type,
      snapshot,
      createdAt: Date.now(),
    };

    this.db.db
      .prepare(
        `INSERT INTO lineage_entries
          (id, project_id, node_id, parent_ids, op_type, snapshot, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.projectId,
        entry.nodeId,
        JSON.stringify(entry.parentIds),
        entry.opType,
        JSON.stringify(entry.snapshot),
        entry.createdAt,
      );

    return entry;
  }

  private nodeIdFor(op: Operation): string | null {
    switch (op.type) {
      case 'op:node:add':
        return op.node.id;
      case 'op:node:remove':
      case 'op:node:update':
        return op.nodeId;
      case 'op:edge:add':
        return op.edge.target;
      case 'op:edge:remove':
        return null;
    }
  }

  private parentIdsFor(workflow: Workflow, op: Operation, nodeId: string): string[] {
    if (op.type === 'op:edge:add') {
      return Array.from(
        new Set([...this.upstream.immediateParents(workflow, nodeId)]),
      );
    }
    return this.upstream.immediateParents(workflow, nodeId);
  }

  private snapshotFor(workflow: Workflow, op: Operation, nodeId: string): unknown {
    switch (op.type) {
      case 'op:node:add':
        return { node: op.node };
      case 'op:node:remove':
        return { removed: true };
      case 'op:node:update': {
        const node = workflow.nodes.find((n) => n.id === nodeId);
        return { changes: op.changes, data: node?.data };
      }
      case 'op:edge:add':
        return { edge: op.edge };
      case 'op:edge:remove':
        return { edgeId: op.edgeId };
    }
  }
}
