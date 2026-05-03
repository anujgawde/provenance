import type { Workflow, WorkflowEdge, WorkflowNode, NodeKind } from './workflow';

export interface ChangedNode {
  id: string;
  before: WorkflowNode;
  after: WorkflowNode;
  changedFields: string[];
}

export interface GraphDiff {
  nodes: {
    added: string[];
    removed: string[];
    changed: ChangedNode[];
  };
  edges: {
    added: string[];
    removed: string[];
  };
}

const DATA_KEYS_BY_KIND: Record<NodeKind, readonly string[]> = {
  'text-prompt': ['label', 'text'],
  'image-reference': ['label', 'url'],
  'ai-model': ['label', 'model', 'systemPrompt', 'temperature', 'status'],
  'style-modifier': ['label', 'style', 'weight'],
  output: ['label', 'text', 'lineageId'],
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function diffNode(before: WorkflowNode, after: WorkflowNode): string[] {
  const fields: string[] = [];
  if (before.type !== after.type) fields.push('type');
  if (before.position.x !== after.position.x || before.position.y !== after.position.y) {
    fields.push('position');
  }
  const keys = DATA_KEYS_BY_KIND[after.type] ?? Object.keys(after.data ?? {});
  const beforeData = (before.data ?? {}) as Record<string, unknown>;
  const afterData = (after.data ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    if (!deepEqual(beforeData[key], afterData[key])) {
      fields.push(`data.${key}`);
    }
  }
  return fields;
}

export function diffGraphs(before: Workflow, after: Workflow): GraphDiff {
  const beforeNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const afterNodes = new Map(after.nodes.map((n) => [n.id, n]));

  const addedNodes: string[] = [];
  const removedNodes: string[] = [];
  const changedNodes: ChangedNode[] = [];

  for (const [id, node] of afterNodes) {
    const prev = beforeNodes.get(id);
    if (!prev) {
      addedNodes.push(id);
      continue;
    }
    const fields = diffNode(prev, node);
    if (fields.length > 0) {
      changedNodes.push({ id, before: prev, after: node, changedFields: fields });
    }
  }
  for (const id of beforeNodes.keys()) {
    if (!afterNodes.has(id)) removedNodes.push(id);
  }

  const beforeEdges = new Map(before.edges.map((e) => [e.id, e]));
  const afterEdges = new Map(after.edges.map((e) => [e.id, e]));
  const addedEdges: string[] = [];
  const removedEdges: string[] = [];
  for (const id of afterEdges.keys()) if (!beforeEdges.has(id)) addedEdges.push(id);
  for (const id of beforeEdges.keys()) if (!afterEdges.has(id)) removedEdges.push(id);

  return {
    nodes: { added: addedNodes, removed: removedNodes, changed: changedNodes },
    edges: { added: addedEdges, removed: removedEdges },
  };
}

// Test-only helper export to make targeted assertions easier.
export const __test = { deepEqual, diffNode };

// Re-export types referenced for convenience.
export type { WorkflowNode, WorkflowEdge };
