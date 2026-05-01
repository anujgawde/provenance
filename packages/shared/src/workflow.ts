import type { AiModelDescriptor } from './ai';

export type NodeKind =
  | 'text-prompt'
  | 'image-reference'
  | 'ai-model'
  | 'style-modifier'
  | 'output';

export interface XYPosition {
  x: number;
  y: number;
}

export interface BaseNodeData {
  label?: string;
}

export interface TextPromptNodeData extends BaseNodeData {
  text: string;
}

export interface ImageReferenceNodeData extends BaseNodeData {
  url: string;
}

export interface AiModelNodeData extends BaseNodeData {
  model: AiModelDescriptor;
  systemPrompt?: string;
  temperature?: number;
  status?: 'idle' | 'generating' | 'error';
}

export interface StyleModifierNodeData extends BaseNodeData {
  style: string;
  weight?: number;
}

export interface OutputNodeData extends BaseNodeData {
  text?: string;
  lineageId?: string;
}

export type NodeDataByKind = {
  'text-prompt': TextPromptNodeData;
  'image-reference': ImageReferenceNodeData;
  'ai-model': AiModelNodeData;
  'style-modifier': StyleModifierNodeData;
  output: OutputNodeData;
};

export interface WorkflowNode<K extends NodeKind = NodeKind> {
  id: string;
  type: K;
  position: XYPosition;
  data: NodeDataByKind[K];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface Workflow {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
}
