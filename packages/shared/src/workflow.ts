import type { AiModelDescriptor } from './ai';

export type NodeKind =
  | 'text'
  | 'image'
  | 'video'
  | '3d'
  | 'inpaint'
  | 'upscale'
  | 'world-labs';

export interface XYPosition {
  x: number;
  y: number;
}

export interface BaseNodeData {
  label?: string;
}

export interface GenerativeNodeData extends BaseNodeData {
  prompt: string;
  model?: AiModelDescriptor;
  status: 'idle' | 'generating' | 'error';
  lineageId?: string;
  output?: string;
}

export type NodeDataByKind = {
  text: GenerativeNodeData;
  image: GenerativeNodeData;
  video: GenerativeNodeData;
  '3d': GenerativeNodeData;
  inpaint: GenerativeNodeData;
  upscale: GenerativeNodeData;
  'world-labs': GenerativeNodeData;
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
