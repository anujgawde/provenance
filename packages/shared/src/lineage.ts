import type { AiGenerationInput, AiGenerationOutput, AiModelDescriptor } from './ai';
import type { Workflow } from './workflow';

export interface LineageRecord {
  id: string;
  projectId: string;
  outputNodeId: string | null;
  capturedAt: number;
  generatedBy: string;
  model: AiModelDescriptor;
  workflowSubgraph: Workflow;
  generationInput: AiGenerationInput;
  generationOutput: AiGenerationOutput | null;
  error?: string;
}
