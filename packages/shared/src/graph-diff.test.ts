import { describe, it, expect } from 'vitest';
import { diffGraphs } from './graph-diff';
import type { Workflow, WorkflowNode } from './workflow';

const node = (id: string, x = 0, y = 0, prompt = 'a'): WorkflowNode => ({
  id,
  type: 'text',
  position: { x, y },
  data: { prompt, status: 'idle' },
});

const wf = (nodes: WorkflowNode[], edges: Workflow['edges'] = []): Workflow => ({ nodes, edges });

describe('diffGraphs', () => {
  it('reports no changes for identical workflows', () => {
    const w = wf([node('a'), node('b')]);
    const d = diffGraphs(w, w);
    expect(d.nodes.added).toEqual([]);
    expect(d.nodes.removed).toEqual([]);
    expect(d.nodes.changed).toEqual([]);
    expect(d.edges.added).toEqual([]);
    expect(d.edges.removed).toEqual([]);
  });

  it('detects added node', () => {
    const before = wf([node('a')]);
    const after = wf([node('a'), node('b')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.added).toEqual(['b']);
    expect(d.nodes.removed).toEqual([]);
  });

  it('detects removed node', () => {
    const before = wf([node('a'), node('b')]);
    const after = wf([node('a')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.removed).toEqual(['b']);
    expect(d.nodes.added).toEqual([]);
  });

  it('detects position-only change', () => {
    const before = wf([node('a', 0, 0)]);
    const after = wf([node('a', 100, 0)]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0]!.changedFields).toEqual(['position']);
  });

  it('detects data.prompt change', () => {
    const before = wf([node('o', 0, 0, 'first')]);
    const after = wf([node('o', 0, 0, 'second')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0]!.changedFields).toEqual(['data.prompt']);
  });

  it('detects multiple changed fields on one node', () => {
    const before = wf([node('a', 0, 0, 'old')]);
    const after = wf([node('a', 50, 50, 'new')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed[0]!.changedFields).toEqual(['position', 'data.prompt']);
  });

  it('detects added/removed edges by id', () => {
    const before = wf([node('a'), node('b')], [{ id: 'e1', source: 'a', target: 'b' }]);
    const after = wf([node('a'), node('b')], [{ id: 'e2', source: 'a', target: 'b' }]);
    const d = diffGraphs(before, after);
    expect(d.edges.added).toEqual(['e2']);
    expect(d.edges.removed).toEqual(['e1']);
  });

  it('does not flag changes for unknown data keys outside the kind whitelist', () => {
    const before: Workflow = wf([
      { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: { prompt: 't', status: 'idle' } },
    ]);
    const after: Workflow = wf([
      { id: 'a', type: 'text', position: { x: 0, y: 0 }, data: { prompt: 't', status: 'idle', stray: 1 } as never },
    ]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed).toEqual([]);
  });
});
