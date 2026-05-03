import { Injectable } from '@nestjs/common';
import type { Workflow } from '@provenance/shared';
import { DbService } from './db.service';

@Injectable()
export class WorkflowPersistenceService {
  constructor(private readonly db: DbService) {}

  save(projectId: string, workflow: Workflow, seq: number): void {
    this.db.db
      .prepare(
        `INSERT INTO project_workflows (project_id, workflow, seq, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id) DO UPDATE SET
           workflow = excluded.workflow,
           seq = excluded.seq,
           updated_at = excluded.updated_at`,
      )
      .run(projectId, JSON.stringify(workflow), seq, Date.now());
  }

  load(projectId: string): { workflow: Workflow; seq: number } | null {
    const row = this.db.db
      .prepare(`SELECT workflow, seq FROM project_workflows WHERE project_id = ?`)
      .get(projectId) as { workflow: string; seq: number } | undefined;
    if (!row) return null;
    return { workflow: JSON.parse(row.workflow), seq: row.seq };
  }
}
