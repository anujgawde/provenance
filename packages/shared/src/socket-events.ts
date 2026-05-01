import type { AiGenerationInput } from './ai';
import type { LineageRecord } from './lineage';
import type { Operation } from './operations';
import type { Workflow, WorkflowNode } from './workflow';

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
}

export interface SessionState {
  projectId: string;
  workflow: Workflow;
  lineages: LineageRecord[];
  users: PresenceUser[];
  lastSeq: number;
}

export interface JoinAck {
  ok: true;
  state: SessionState;
}

export interface GenerateAck {
  ok: true;
  lineageId: string;
  outputNodeId: string;
}

export interface ErrorAck {
  ok: false;
  error: string;
}

export type Ack<T> = T | ErrorAck;

export interface ClientToServerEvents {
  'session:join': (
    payload: { projectId: string; user: PresenceUser },
    ack: (response: Ack<JoinAck>) => void,
  ) => void;
  'op:node:add': (op: Extract<Operation, { type: 'op:node:add' }>) => void;
  'op:node:remove': (op: Extract<Operation, { type: 'op:node:remove' }>) => void;
  'op:node:update': (op: Extract<Operation, { type: 'op:node:update' }>) => void;
  'op:edge:add': (op: Extract<Operation, { type: 'op:edge:add' }>) => void;
  'op:edge:remove': (op: Extract<Operation, { type: 'op:edge:remove' }>) => void;
  'cursor:move': (payload: { x: number; y: number }) => void;
  'generate:request': (
    payload: { aiNodeId: string; input: AiGenerationInput },
    ack: (response: Ack<GenerateAck>) => void,
  ) => void;
  'lineage:restore': (payload: { lineageId: string }) => void;
}

export interface ServerToClientEvents {
  'session:state': (state: SessionState) => void;
  'session:users': (users: PresenceUser[]) => void;
  'op:node:add': (op: Extract<Operation, { type: 'op:node:add' }> & { seq: number }) => void;
  'op:node:remove': (op: Extract<Operation, { type: 'op:node:remove' }> & { seq: number }) => void;
  'op:node:update': (op: Extract<Operation, { type: 'op:node:update' }> & { seq: number }) => void;
  'op:edge:add': (op: Extract<Operation, { type: 'op:edge:add' }> & { seq: number }) => void;
  'op:edge:remove': (op: Extract<Operation, { type: 'op:edge:remove' }> & { seq: number }) => void;
  'cursor:move': (payload: { userId: string; x: number; y: number }) => void;
  'lineage:captured': (payload: { lineage: LineageRecord; outputNode: WorkflowNode }) => void;
  'lineage:restore': (payload: { lineageId: string; workflow: Workflow }) => void;
}

export const SOCKET_PATH = '/socket.io';
