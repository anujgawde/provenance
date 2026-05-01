import type { WorkflowEdge, WorkflowNode, XYPosition } from './workflow';

export type Operation =
  | { type: 'op:node:add'; node: WorkflowNode }
  | { type: 'op:node:remove'; nodeId: string }
  | {
      type: 'op:node:update';
      nodeId: string;
      changes: { position?: XYPosition; data?: Record<string, unknown> };
    }
  | { type: 'op:edge:add'; edge: WorkflowEdge }
  | { type: 'op:edge:remove'; edgeId: string };

export type OperationType = Operation['type'];

export interface StampedOperation {
  seq: number;
  origin: string;
  op: Operation;
}
