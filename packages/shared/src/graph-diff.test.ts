import { describe, it, expect } from 'vitest';
import { diffGraphs } from './graph-diff';
import type { Workflow, WorkflowNode } from './workflow';

const text = (id: string, x = 0, y = 0, t = 'a'): WorkflowNode => ({
  id,
  type: 'text-prompt',
  position: { x, y },
  data: { text: t },
});

const output = (id: string, t = ''): WorkflowNode => ({
  id,
  type: 'output',
  position: { x: 0, y: 0 },
  data: { text: t },
});

const wf = (nodes: WorkflowNode[], edges: Workflow['edges'] = []): Workflow => ({ nodes, edges });

describe('diffGraphs', () => {
  it('reports no changes for identical workflows', () => {
    const w = wf([text('a'), output('b')]);
    const d = diffGraphs(w, w);
    expect(d.nodes.added).toEqual([]);
    expect(d.nodes.removed).toEqual([]);
    expect(d.nodes.changed).toEqual([]);
    expect(d.edges.added).toEqual([]);
    expect(d.edges.removed).toEqual([]);
  });

  it('detects added node', () => {
    const before = wf([text('a')]);
    const after = wf([text('a'), text('b')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.added).toEqual(['b']);
    expect(d.nodes.removed).toEqual([]);
  });

  it('detects removed node', () => {
    const before = wf([text('a'), text('b')]);
    const after = wf([text('a')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.removed).toEqual(['b']);
    expect(d.nodes.added).toEqual([]);
  });

  it('detects position-only change', () => {
    const before = wf([text('a', 0, 0)]);
    const after = wf([text('a', 100, 0)]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0]!.changedFields).toEqual(['position']);
  });

  it('detects data.text change', () => {
    const before = wf([output('o', 'first')]);
    const after = wf([output('o', 'second')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed).toHaveLength(1);
    expect(d.nodes.changed[0]!.changedFields).toEqual(['data.text']);
  });

  it('detects multiple changed fields on one node', () => {
    const before = wf([text('a', 0, 0, 'old')]);
    const after = wf([text('a', 50, 50, 'new')]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed[0]!.changedFields).toEqual(['position', 'data.text']);
  });

  it('detects added/removed edges by id', () => {
    const before = wf([text('a'), text('b')], [{ id: 'e1', source: 'a', target: 'b' }]);
    const after = wf([text('a'), text('b')], [{ id: 'e2', source: 'a', target: 'b' }]);
    const d = diffGraphs(before, after);
    expect(d.edges.added).toEqual(['e2']);
    expect(d.edges.removed).toEqual(['e1']);
  });

  it('does not flag changes for unknown data keys outside the kind whitelist', () => {
    const before: Workflow = wf([
      { id: 'a', type: 'text-prompt', position: { x: 0, y: 0 }, data: { text: 't' } },
    ]);
    // Add a stray field that isn't part of TextPromptNodeData; should be ignored.
    const after: Workflow = wf([
      { id: 'a', type: 'text-prompt', position: { x: 0, y: 0 }, data: { text: 't', stray: 1 } as never },
    ]);
    const d = diffGraphs(before, after);
    expect(d.nodes.changed).toEqual([]);
  });
});
