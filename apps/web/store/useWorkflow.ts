'use client';

import { create } from 'zustand';
import type {
  GraphDiff,
  Operation,
  PresenceUser,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
} from '@provenance/shared';

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
  ts: number;
}

interface WorkflowStore {
  workflow: Workflow;
  users: PresenceUser[];
  cursors: Record<string, RemoteCursor>;
  projectId: string;
  ancestryNodeId: string | null;
  setWorkflow: (w: Workflow) => void;
  setUsers: (u: PresenceUser[]) => void;
  setProjectId: (id: string) => void;
  setAncestryNodeId: (id: string | null) => void;
  applyRemoteOp: (op: Operation) => void;
  upsertNode: (node: WorkflowNode) => void;
  removeNode: (id: string) => void;
  updateNode: (
    id: string,
    changes: { position?: WorkflowNode['position']; data?: Record<string, unknown> },
  ) => void;
  upsertEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  setCursor: (c: RemoteCursor) => void;
  dropCursor: (userId: string) => void;
  // Bit 5 — compare mode (local-only, not relayed via socket)
  compareSelection: string[];
  compareBefore: Workflow | null;
  compareAfter: Workflow | null;
  compareDiff: GraphDiff | null;
  toggleCompareSelection: (lineageId: string) => void;
  enterCompareMode: (before: Workflow, after: Workflow, diff: GraphDiff) => void;
  exitCompareMode: () => void;
}

export const useWorkflowStore = create<WorkflowStore>((set) => ({
  workflow: { nodes: [], edges: [] },
  users: [],
  cursors: {},
  projectId: '',
  ancestryNodeId: null,
  setWorkflow: (workflow) => set({ workflow }),
  setUsers: (users) => set({ users }),
  setProjectId: (projectId) => set({ projectId }),
  setAncestryNodeId: (ancestryNodeId) => set({ ancestryNodeId }),
  applyRemoteOp: (op) =>
    set((state) => {
      const w = { nodes: [...state.workflow.nodes], edges: [...state.workflow.edges] };
      switch (op.type) {
        case 'op:node:add':
          if (!w.nodes.find((n) => n.id === op.node.id)) w.nodes.push(op.node);
          break;
        case 'op:node:remove':
          w.nodes = w.nodes.filter((n) => n.id !== op.nodeId);
          w.edges = w.edges.filter((e) => e.source !== op.nodeId && e.target !== op.nodeId);
          break;
        case 'op:node:update': {
          const idx = w.nodes.findIndex((n) => n.id === op.nodeId);
          if (idx === -1) break;
          const existing = w.nodes[idx]!;
          const node: WorkflowNode = { ...existing };
          if (op.changes.position) node.position = op.changes.position;
          if (op.changes.data) node.data = { ...node.data, ...op.changes.data } as typeof node.data;
          w.nodes[idx] = node;
          break;
        }
        case 'op:edge:add':
          if (!w.edges.find((e) => e.id === op.edge.id)) w.edges.push(op.edge);
          break;
        case 'op:edge:remove':
          w.edges = w.edges.filter((e) => e.id !== op.edgeId);
          break;
      }
      return { workflow: w };
    }),
  upsertNode: (node) =>
    set((state) => {
      const exists = state.workflow.nodes.find((n) => n.id === node.id);
      const nodes = exists
        ? state.workflow.nodes.map((n) => (n.id === node.id ? node : n))
        : [...state.workflow.nodes, node];
      return { workflow: { ...state.workflow, nodes } };
    }),
  removeNode: (id) =>
    set((state) => ({
      workflow: {
        nodes: state.workflow.nodes.filter((n) => n.id !== id),
        edges: state.workflow.edges.filter((e) => e.source !== id && e.target !== id),
      },
    })),
  updateNode: (id, changes) =>
    set((state) => ({
      workflow: {
        ...state.workflow,
        nodes: state.workflow.nodes.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n };
          if (changes.position) next.position = changes.position;
          if (changes.data) next.data = { ...next.data, ...changes.data } as typeof next.data;
          return next;
        }),
      },
    })),
  upsertEdge: (edge) =>
    set((state) => {
      const exists = state.workflow.edges.find((e) => e.id === edge.id);
      const edges = exists
        ? state.workflow.edges.map((e) => (e.id === edge.id ? edge : e))
        : [...state.workflow.edges, edge];
      return { workflow: { ...state.workflow, edges } };
    }),
  removeEdge: (id) =>
    set((state) => ({
      workflow: { ...state.workflow, edges: state.workflow.edges.filter((e) => e.id !== id) },
    })),
  setCursor: (c) => set((state) => ({ cursors: { ...state.cursors, [c.userId]: c } })),
  dropCursor: (userId) =>
    set((state) => {
      const next = { ...state.cursors };
      delete next[userId];
      return { cursors: next };
    }),
  compareSelection: [],
  compareBefore: null,
  compareAfter: null,
  compareDiff: null,
  toggleCompareSelection: (lineageId) =>
    set((state) => {
      const exists = state.compareSelection.includes(lineageId);
      if (exists) {
        return {
          compareSelection: state.compareSelection.filter((id) => id !== lineageId),
        };
      }
      // Cap at 2: drop the oldest if we're already at 2.
      const next = [...state.compareSelection, lineageId].slice(-2);
      return { compareSelection: next };
    }),
  enterCompareMode: (before, after, diff) =>
    set({ compareBefore: before, compareAfter: after, compareDiff: diff }),
  exitCompareMode: () =>
    set({
      compareSelection: [],
      compareBefore: null,
      compareAfter: null,
      compareDiff: null,
    }),
}));
