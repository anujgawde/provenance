'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useWorkflowStore } from '@/store/useWorkflow';
import { getSocket } from '@/lib/socket';
import { fetchLineage, type Generation } from '@/lib/api';
import { nodeTypes } from './NodeTypes';
import type { Workflow, WorkflowEdge, WorkflowNode } from '@provenance/shared';
import type { Edge, Node } from 'reactflow';

function getUpstreamSubgraph(workflow: Workflow, nodeId: string): Workflow {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const edge of workflow.edges.filter((e) => e.target === current)) {
      queue.push(edge.source);
    }
  }
  return {
    nodes: workflow.nodes.filter((n) => visited.has(n.id)),
    edges: workflow.edges.filter((e) => visited.has(e.source) && visited.has(e.target)),
  };
}

function toRfNode(n: WorkflowNode): Node {
  return { id: n.id, type: n.type, position: n.position, data: n.data };
}

function toRfEdge(e: WorkflowEdge): Edge {
  return { id: e.id, source: e.source, target: e.target };
}

function MiniGraph({ nodeId }: { nodeId: string }) {
  const workflow = useWorkflowStore((s) => s.workflow);
  const subgraph = useMemo(() => getUpstreamSubgraph(workflow, nodeId), [workflow, nodeId]);
  const rfNodes = useMemo(() => subgraph.nodes.map(toRfNode), [subgraph.nodes]);
  const rfEdges = useMemo(() => subgraph.edges.map(toRfEdge), [subgraph.edges]);

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

export function AncestryPanel({ projectId }: { projectId: string }) {
  const ancestryNodeId = useWorkflowStore((s) => s.ancestryNodeId);
  const setAncestryNodeId = useWorkflowStore((s) => s.setAncestryNodeId);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const isOpen = ancestryNodeId !== null;

  useEffect(() => {
    if (!ancestryNodeId) {
      setGenerations([]);
      return;
    }
    setLoading(true);
    fetchLineage(projectId, ancestryNodeId).then((gens) => {
      setGenerations([...gens].reverse());
      setLoading(false);
    });
  }, [projectId, ancestryNodeId]);

  const handleRestore = useCallback(
    (gen: Generation) => {
      if (!ancestryNodeId) return;
      setRestoringId(gen.id);
      updateNode(ancestryNodeId, { data: { text: gen.text } });
      getSocket().emit('op:node:update', {
        type: 'op:node:update',
        nodeId: ancestryNodeId,
        changes: { data: { text: gen.text } },
      });
      setTimeout(() => setRestoringId(null), 600);
    },
    [ancestryNodeId, updateNode],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        height: '100vh',
        width: 380,
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
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f121e' }}>Ancestry</div>
          {generations.length > 0 && (
            <div style={{ fontSize: 11, color: 'rgba(15,18,30,0.45)', marginTop: 2 }}>
              {generations.length} generation{generations.length !== 1 ? 's' : ''}
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

      {/* Mini graph */}
      {ancestryNodeId && (
        <div style={{ height: 200, flexShrink: 0, margin: '12px 12px 0' }}>
          <MiniGraph nodeId={ancestryNodeId} />
        </div>
      )}

      {/* Upstream label */}
      <div
        style={{
          padding: '10px 18px 6px',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'rgba(15,18,30,0.35)',
          flexShrink: 0,
        }}
      >
        Generation History
      </div>

      {/* Generations list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {loading && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(15,18,30,0.4)',
            }}
          >
            Loading…
          </div>
        )}

        {!loading && generations.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(15,18,30,0.4)',
            }}
          >
            No generations recorded yet.
            <br />
            Connect an AI model and generate output.
          </div>
        )}

        {generations.map((gen, idx) => (
          <div
            key={gen.id}
            style={{
              background: '#fafbff',
              border: '1px solid rgba(15,18,30,0.07)',
              borderRadius: 14,
              padding: '12px 14px',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    background: '#39B27A',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {generations.length - idx}
                </div>
                <span style={{ fontSize: 11, color: 'rgba(15,18,30,0.45)' }}>
                  {formatTime(gen.createdAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRestore(gen)}
                disabled={restoringId === gen.id}
                style={{
                  background: restoringId === gen.id ? '#39B27A' : 'rgba(57,178,122,0.10)',
                  color: restoringId === gen.id ? '#fff' : '#39B27A',
                  border: 'none',
                  borderRadius: 8,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 200ms, color 200ms',
                }}
              >
                {restoringId === gen.id ? '✓ Restored' : 'Restore'}
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(15,18,30,0.65)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {gen.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
