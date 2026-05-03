import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Operation, Workflow } from '@provenance/shared';
import { DbService } from '../db/db.service';
import { UpstreamService } from './upstream.service';

export interface Generation {
  id: string;
  createdAt: number;
  text: string;
  parentIds: string[];
}

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

  /**
   * Bit 5: persist a full post-op workflow snapshot alongside an existing
   * lineage entry. Called by the gateway AFTER applyOp so the snapshot reflects
   * the workflow state the generation produced.
   */
  attachWorkflowSnapshot(entryId: string, workflow: Workflow): void {
    this.db.db
      .prepare(`UPDATE lineage_entries SET workflow_snapshot = ? WHERE id = ?`)
      .run(JSON.stringify(workflow), entryId);
  }

  getWorkflowSnapshot(projectId: string, entryId: string): Workflow | null {
    const row = this.db.db
      .prepare(
        `SELECT workflow_snapshot FROM lineage_entries
         WHERE id = ? AND project_id = ?`,
      )
      .get(entryId, projectId) as { workflow_snapshot: string | null } | undefined;
    if (!row || !row.workflow_snapshot) return null;
    return JSON.parse(row.workflow_snapshot) as Workflow;
  }

  getGenerations(projectId: string, nodeId: string): Generation[] {
    type Row = { id: string; parent_ids: string; snapshot: string; created_at: number };
    const rows = this.db.db
      .prepare(
        `SELECT id, parent_ids, snapshot, created_at
         FROM lineage_entries
         WHERE project_id = ? AND node_id = ? AND op_type = 'op:node:update'
         ORDER BY created_at ASC`,
      )
      .all(projectId, nodeId) as Row[];

    return rows
      .map((row) => {
        const snap = JSON.parse(row.snapshot) as {
          changes?: { data?: { text?: string } };
          data?: { text?: string };
        };
        const text = snap.changes?.data?.text ?? snap.data?.text ?? '';
        return {
          id: row.id,
          createdAt: row.created_at,
          parentIds: JSON.parse(row.parent_ids) as string[],
          text,
        };
      })
      .filter((g) => g.text !== '');
  }
}
