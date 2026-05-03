'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '@/store/useWorkflow';
import { fetchLineages } from '@/lib/api';
import { nodeTypes } from './NodeTypes';
import {
  diffGraphs,
  type LineageRecord,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
} from '@provenance/shared';
import type { Edge, Node } from 'reactflow';

function toRfNode(n: WorkflowNode): Node {
  return { id: n.id, type: n.type, position: n.position, data: n.data };
}

function toRfEdge(e: WorkflowEdge): Edge {
  return { id: e.id, source: e.source, target: e.target };
}

function SubgraphMini({ subgraph }: { subgraph: Workflow }) {
  const rfNodes = useMemo(() => subgraph.nodes.map(toRfNode), [subgraph.nodes]);
  const rfEdges = useMemo(() => subgraph.edges.map(toRfEdge), [subgraph.edges]);

  if (subgraph.nodes.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(15,18,30,0.3)',
          fontSize: 11,
        }}
      >
        No upstream nodes
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        fitView
        style={{ background: '#f5f6fa', borderRadius: 12 }}
      >
        <Background gap={20} size={1} color="rgba(15,18,30,0.08)" />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOutputText(lineage: LineageRecord): string {
  if (!lineage.generationOutput) return '';
  return lineage.generationOutput.text ?? '';
}

export function AncestryPanel({ projectId }: { projectId: string }) {
  const ancestryNodeId = useWorkflowStore((s) => s.ancestryNodeId);
  const setAncestryNodeId = useWorkflowStore((s) => s.setAncestryNodeId);
  const compareSelection = useWorkflowStore((s) => s.compareSelection);
  const compareDiff = useWorkflowStore((s) => s.compareDiff);
  const toggleCompareSelection = useWorkflowStore((s) => s.toggleCompareSelection);
  const enterCompareMode = useWorkflowStore((s) => s.enterCompareMode);
  const exitCompareMode = useWorkflowStore((s) => s.exitCompareMode);

  const [lineages, setLineages] = useState<LineageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const isOpen = ancestryNodeId !== null;

  useEffect(() => {
    if (!ancestryNodeId) {
      setLineages([]);
      return;
    }
    setLoading(true);
    fetchLineages(projectId, ancestryNodeId).then((records) => {
      setLineages([...records].reverse());
      setLoading(false);
    });
  }, [projectId, ancestryNodeId]);

  const handleCompareClick = useCallback(
    (record: LineageRecord) => {
      const already = compareSelection.includes(record.id);
      toggleCompareSelection(record.id);
      const next = already
        ? compareSelection.filter((id) => id !== record.id)
        : [...compareSelection, record.id].slice(-2);

      if (next.length === 2) {
        setCompareLoading(true);
        const a = lineages.find((l) => l.id === next[0]);
        const b = lineages.find((l) => l.id === next[1]);
        if (a && b) {
          const [before, after] =
            a.capturedAt <= b.capturedAt
              ? [a.workflowSubgraph, b.workflowSubgraph]
              : [b.workflowSubgraph, a.workflowSubgraph];
          enterCompareMode(before, after, diffGraphs(before, after));
        }
        setCompareLoading(false);
      } else {
        if (compareDiff) exitCompareMode();
      }
    },
    [compareSelection, lineages, toggleCompareSelection, enterCompareMode, exitCompareMode, compareDiff],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100vh',
        width: 400,
        background: '#fff',
        borderLeft: '1px solid rgba(15,18,30,0.08)',
        boxShadow: '-8px 0 32px rgba(15,18,30,0.08)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 18px 14px',
          borderBottom: '1px solid rgba(15,18,30,0.07)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f121e' }}>Provenance</div>
          {lineages.length > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(15,18,30,0.45)', marginTop: 2 }}>
              {lineages.length} generation{lineages.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAncestryNodeId(null)}
          style={{
            background: 'rgba(15,18,30,0.06)',
            border: 'none',
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: 'pointer',
            fontSize: 14,
            color: 'rgba(15,18,30,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Compare-mode banner */}
      {compareDiff && (
        <div
          style={{
            margin: '10px 12px 0',
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.20)',
            color: '#3730A3',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontWeight: 600 }}>
            Comparing 2 generations · {compareDiff.nodes.added.length}+
            {' / '}
            {compareDiff.nodes.removed.length}-{' / '}
            {compareDiff.nodes.changed.length}~
          </span>
          <button
            type="button"
            onClick={exitCompareMode}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3730A3',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Exit (Esc)
          </button>
        </div>
      )}

      {/* Section label */}
      <div
        style={{
          padding: '12px 18px 6px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'rgba(15,18,30,0.35)',
          flexShrink: 0,
        }}
      >
        Generation Lineage
      </div>

      {/* Lineage list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'rgba(15,18,30,0.4)' }}>
            Loading…
          </div>
        )}

        {!loading && lineages.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'rgba(15,18,30,0.4)' }}>
            No generations recorded yet.
            <br />
            Connect an AI model and click Generate.
          </div>
        )}

        {lineages.map((record, idx) => {
          const isExpanded = expandedId === record.id;
          const outputText = getOutputText(record);
          const compareIdx = compareSelection.indexOf(record.id);
          const isSelected = compareIdx !== -1;

          return (
            <div
              key={record.id}
              style={{
                background: '#fafbff',
                border: isSelected
                  ? '1.5px solid rgba(99,102,241,0.4)'
                  : '1px solid rgba(15,18,30,0.07)',
                borderRadius: 14,
                marginBottom: 8,
                overflow: 'hidden',
              }}
            >
              {/* Row header */}
              <div
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: record.error ? '#EF4444' : '#3F3FE0',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {lineages.length - idx}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(15,18,30,0.7)', fontWeight: 500 }}>
                      {formatTime(record.capturedAt)}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(15,18,30,0.4)' }}>
                      {record.model.provider}/{record.model.model}
                      {' · '}
                      {record.workflowSubgraph.nodes.length} nodes
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleCompareClick(record); }}
                    disabled={compareLoading}
                    style={{
                      background: isSelected ? '#6366F1' : 'rgba(99,102,241,0.10)',
                      color: isSelected ? '#fff' : '#6366F1',
                      border: 'none',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: compareLoading ? 'wait' : 'pointer',
                      transition: 'background 200ms, color 200ms',
                    }}
                  >
                    {isSelected ? `Compare ${compareIdx + 1}/2` : 'Compare'}
                  </button>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'rgba(15,18,30,0.3)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                      transition: 'transform 200ms',
                      display: 'inline-block',
                    }}
                  >
                    ▾
                  </span>
                </div>
              </div>

              {/* Expanded: subgraph + output */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(15,18,30,0.06)' }}>
                  {/* Upstream subgraph mini view */}
                  <div style={{ height: 180, margin: '8px 10px' }}>
                    <SubgraphMini subgraph={record.workflowSubgraph} />
                  </div>

                  {/* Generation output */}
                  {outputText && (
                    <div
                      style={{
                        margin: '0 14px 10px',
                        padding: 10,
                        borderRadius: 10,
                        background: 'rgba(57,178,122,0.06)',
                        border: '1px solid rgba(57,178,122,0.15)',
                        fontSize: 11,
                        color: 'rgba(15,18,30,0.7)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 120,
                        overflowY: 'auto',
                      }}
                    >
                      {outputText}
                    </div>
                  )}

                  {record.error && (
                    <div
                      style={{
                        margin: '0 14px 10px',
                        padding: 10,
                        borderRadius: 10,
                        background: 'rgba(239,68,68,0.06)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        fontSize: 11,
                        color: '#B91C1C',
                      }}
                    >
                      {record.error}
                    </div>
                  )}

                  {/* Input details */}
                  <div
                    style={{
                      margin: '0 14px 12px',
                      fontSize: 10,
                      color: 'rgba(15,18,30,0.45)',
                      lineHeight: 1.5,
                    }}
                  >
                    <div><strong>Prompt:</strong> {record.generationInput.prompt}</div>
                    {record.generationInput.system && (
                      <div><strong>System:</strong> {record.generationInput.system}</div>
                    )}
                    {record.generationOutput?.usage && (
                      <div>
                        Tokens: {record.generationOutput.usage.inputTokens} in / {record.generationOutput.usage.outputTokens} out
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
