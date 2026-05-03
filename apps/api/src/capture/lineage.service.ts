import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AiGenerationInput,
  AiGenerationOutput,
  AiModelDescriptor,
  LineageRecord,
  Workflow,
} from '@provenance/shared';
import { DbService } from '../db/db.service';
import { UpstreamService } from './upstream.service';

export interface CreateLineageParams {
  projectId: string;
  aiNodeId: string;
  outputNodeId: string | null;
  generatedBy: string;
  model: AiModelDescriptor;
  workflow: Workflow;
  input: AiGenerationInput;
}

@Injectable()
export class LineageService {
  constructor(
    private readonly db: DbService,
    private readonly upstream: UpstreamService,
  ) {}

  capture(params: CreateLineageParams): LineageRecord {
    const subgraph = this.upstream.upstreamSubgraph(params.workflow, params.aiNodeId);
    const id = randomUUID();
    const now = Date.now();

    this.db.db
      .prepare(
        `INSERT INTO lineages
          (id, project_id, output_node_id, ai_node_id, captured_at,
           generated_by, model_provider, model_name,
           workflow_subgraph, generation_input)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        params.projectId,
        params.outputNodeId,
        params.aiNodeId,
        now,
        params.generatedBy,
        params.model.provider,
        params.model.model,
        JSON.stringify(subgraph),
        JSON.stringify(params.input),
      );

    return {
      id,
      projectId: params.projectId,
      outputNodeId: params.outputNodeId,
      capturedAt: now,
      generatedBy: params.generatedBy,
      model: params.model,
      workflowSubgraph: subgraph,
      generationInput: params.input,
      generationOutput: null,
    };
  }

  attachOutput(lineageId: string, output: AiGenerationOutput): void {
    this.db.db
      .prepare(`UPDATE lineages SET generation_output = ? WHERE id = ?`)
      .run(JSON.stringify(output), lineageId);
  }

  attachOutputNodeId(lineageId: string, outputNodeId: string): void {
    this.db.db
      .prepare(`UPDATE lineages SET output_node_id = ? WHERE id = ?`)
      .run(outputNodeId, lineageId);
  }

  attachError(lineageId: string, error: string): void {
    this.db.db
      .prepare(`UPDATE lineages SET error = ? WHERE id = ?`)
      .run(error, lineageId);
  }

  getByOutputNode(projectId: string, outputNodeId: string): LineageRecord[] {
    type Row = {
      id: string;
      project_id: string;
      output_node_id: string | null;
      captured_at: number;
      generated_by: string;
      model_provider: string;
      model_name: string;
      workflow_subgraph: string;
      generation_input: string;
      generation_output: string | null;
      error: string | null;
    };
    const rows = this.db.db
      .prepare(
        `SELECT * FROM lineages
         WHERE project_id = ? AND output_node_id = ?
         ORDER BY captured_at ASC`,
      )
      .all(projectId, outputNodeId) as Row[];

    return rows.map((r) => this.rowToRecord(r));
  }

  getById(projectId: string, lineageId: string): LineageRecord | null {
    type Row = {
      id: string;
      project_id: string;
      output_node_id: string | null;
      captured_at: number;
      generated_by: string;
      model_provider: string;
      model_name: string;
      workflow_subgraph: string;
      generation_input: string;
      generation_output: string | null;
      error: string | null;
    };
    const row = this.db.db
      .prepare(`SELECT * FROM lineages WHERE id = ? AND project_id = ?`)
      .get(lineageId, projectId) as Row | undefined;

    return row ? this.rowToRecord(row) : null;
  }

  private rowToRecord(r: {
    id: string;
    project_id: string;
    output_node_id: string | null;
    captured_at: number;
    generated_by: string;
    model_provider: string;
    model_name: string;
    workflow_subgraph: string;
    generation_input: string;
    generation_output: string | null;
    error: string | null;
  }): LineageRecord {
    return {
      id: r.id,
      projectId: r.project_id,
      outputNodeId: r.output_node_id,
      capturedAt: r.captured_at,
      generatedBy: r.generated_by,
      model: { provider: r.model_provider as any, model: r.model_name },
      workflowSubgraph: JSON.parse(r.workflow_subgraph),
      generationInput: JSON.parse(r.generation_input),
      generationOutput: r.generation_output ? JSON.parse(r.generation_output) : null,
      error: r.error ?? undefined,
    };
  }
}
