'use client';

import { useState } from 'react';
import { useViewport } from 'reactflow';
import { useWorkflowStore } from '@/store/useWorkflow';
import type { WorkflowNode } from '@provenance/shared';

const NODE_W = 260;
const NODE_H = 140;
const HALO_PAD = 6;

const COLOR = {
  added: { stroke: '#39B27A', fill: 'rgba(57,178,122,0.12)' },
  removed: { stroke: '#E5484D', fill: 'rgba(229,72,77,0.10)' },
  changed: { stroke: '#F5A524', fill: 'rgba(245,165,36,0.12)' },
} as const;

type HaloKind = keyof typeof COLOR;

function fmtField(v: unknown): string {
  if (v === undefined || v === null) return '∅';
  if (typeof v === 'string') return v.length > 60 ? `${v.slice(0, 60)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  } catch {
    return '<obj>';
  }
}

export function CompareOverlay() {
  const before = useWorkflowStore((s) => s.compareBefore);
  const after = useWorkflowStore((s) => s.compareAfter);
  const diff = useWorkflowStore((s) => s.compareDiff);
  const { x: vx, y: vy, zoom } = useViewport();
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (!diff || !before || !after) return null;

  const beforeMap = new Map(before.nodes.map((n) => [n.id, n]));
  const afterMap = new Map(after.nodes.map((n) => [n.id, n]));

  const halos: Array<{ id: string; kind: HaloKind; node: WorkflowNode }> = [];
  for (const id of diff.nodes.added) {
    const n = afterMap.get(id);
    if (n) halos.push({ id, kind: 'added', node: n });
  }
  for (const id of diff.nodes.removed) {
    const n = beforeMap.get(id);
    if (n) halos.push({ id, kind: 'removed', node: n });
  }
  for (const ch of diff.nodes.changed) {
    halos.push({ id: ch.id, kind: 'changed', node: ch.after });
  }

  const flowToScreen = (fx: number, fy: number) => ({
    x: fx * zoom + vx,
    y: fy * zoom + vy,
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      {halos.map(({ id, kind, node }) => {
        const { x, y } = flowToScreen(node.position.x, node.position.y);
        const w = NODE_W * zoom + HALO_PAD * 2;
        const h = NODE_H * zoom + HALO_PAD * 2;
        const left = x - HALO_PAD;
        const top = y - HALO_PAD;
        const c = COLOR[kind];
        const changed = diff.nodes.changed.find((ch) => ch.id === id);
        return (
          <div
            key={`${kind}-${id}`}
            style={{
              position: 'absolute',
              left,
              top,
              width: w,
              height: h,
              border: `2px solid ${c.stroke}`,
              background: c.fill,
              borderRadius: 22,
              boxShadow: `0 0 0 4px ${c.fill}`,
              pointerEvents: 'auto',
            }}
            onMouseEnter={() => setHoverId(id)}
            onMouseLeave={() => setHoverId((cur) => (cur === id ? null : cur))}
          >
            <div
              style={{
                position: 'absolute',
                top: -10,
                left: 10,
                background: c.stroke,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {kind}
            </div>
            {hoverId === id && changed && changed.changedFields.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: h + 8,
                  left: 0,
                  minWidth: 280,
                  background: '#fff',
                  border: '1px solid rgba(15,18,30,0.10)',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(15,18,30,0.14)',
                  padding: 12,
                  fontSize: 11,
                  color: '#0f121e',
                  pointerEvents: 'auto',
                  zIndex: 30,
                  fontFamily:
                    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: 'rgba(15,18,30,0.5)',
                    marginBottom: 6,
                  }}
                >
                  Changes · {changed.changedFields.length}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 1fr',
                    rowGap: 6,
                    columnGap: 8,
                  }}
                >
                  <div style={{ color: 'rgba(15,18,30,0.5)' }}></div>
                  <div style={{ fontWeight: 700, color: '#E5484D' }}>before</div>
                  <div style={{ fontWeight: 700, color: '#39B27A' }}>after</div>
                  {changed.changedFields.map((f) => {
                    const beforeVal = readField(changed.before, f);
                    const afterVal = readField(changed.after, f);
                    return (
                      <FragmentRow key={f} field={f} before={beforeVal} after={afterVal} />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function readField(node: WorkflowNode, field: string): unknown {
  if (field === 'position') return `${Math.round(node.position.x)}, ${Math.round(node.position.y)}`;
  if (field === 'type') return node.type;
  if (field.startsWith('data.')) {
    const key = field.slice('data.'.length);
    return (node.data as Record<string, unknown>)[key];
  }
  return undefined;
}

function FragmentRow({
  field,
  before,
  after,
}: {
  field: string;
  before: unknown;
  after: unknown;
}) {
  return (
    <>
      <div style={{ color: 'rgba(15,18,30,0.55)', fontFamily: 'monospace' }}>{field}</div>
      <div style={{ wordBreak: 'break-word' }}>{fmtField(before)}</div>
      <div style={{ wordBreak: 'break-word' }}>{fmtField(after)}</div>
    </>
  );
}
