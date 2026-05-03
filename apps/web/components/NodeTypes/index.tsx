'use client';

import { useEffect, useState } from 'react';
import type { NodeProps, NodeTypes } from 'reactflow';
import type {
  AiModelNodeData,
  ImageReferenceNodeData,
  OutputNodeData,
  StyleModifierNodeData,
  TextPromptNodeData,
} from '@provenance/shared';
import { useWorkflowStore } from '@/store/useWorkflow';
import { fetchLineage } from '@/lib/api';
import { NodeCard } from './NodeCard';

const ACCENT = '#3F3FE0';

function TextPromptNode({ data }: NodeProps<TextPromptNodeData>) {
  return (
    <NodeCard
      footer={
        <>
          <span>TEXT-TO-TEXT · prompt</span>
          <span style={{ color: ACCENT, fontWeight: 700 }}>T</span>
        </>
      }
      accent={ACCENT}
    >
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.4,
          color: 'rgba(15,18,30,0.85)',
          minHeight: 64,
          whiteSpace: 'pre-wrap',
        }}
      >
        {data.text || 'Type a prompt…'}
      </div>
    </NodeCard>
  );
}

function ImageReferenceNode({ data }: NodeProps<ImageReferenceNodeData>) {
  return (
    <NodeCard
      footer={
        <>
          <span>IMAGE · reference</span>
          <span style={{ color: 'rgba(15,18,30,0.4)' }}>↗ ↑ ↓</span>
        </>
      }
      accent="#E0653F"
    >
      <div
        style={{
          aspectRatio: '4/3',
          borderRadius: 12,
          background: data.url
            ? `center/cover no-repeat url(${data.url})`
            : 'linear-gradient(135deg, #f3f4fb, #e6e9f5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(15,18,30,0.4)',
          fontSize: 12,
        }}
      >
        {!data.url && 'reference image'}
      </div>
    </NodeCard>
  );
}

function StyleModifierNode({ data }: NodeProps<StyleModifierNodeData>) {
  return (
    <NodeCard
      footer={
        <>
          <span>STYLE · modifier</span>
          <span>{(data.weight ?? 1).toFixed(1)}×</span>
        </>
      }
      accent="#C2399F"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Field label="Style" value={data.style || '—'} />
        <Field label="Weight" value={`${(data.weight ?? 1).toFixed(2)}`} />
      </div>
    </NodeCard>
  );
}

function AiModelNode({ data }: NodeProps<AiModelNodeData>) {
  const generating = data.status === 'generating';
  return (
    <NodeCard
      width={280}
      footer={
        <>
          <span>IMAGE-TO-IMAGE · {data.model?.model ?? 'Claude'}</span>
          <span style={{ color: ACCENT, fontWeight: 700 }}>{generating ? '…' : '⏵'}</span>
        </>
      }
      accent={ACCENT}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(15,18,30,0.55)' }}>
          {data.systemPrompt || 'Tap to configure model'}
        </div>
        <button
          type="button"
          disabled
          title="Generate (wired in Bit 6)"
          style={{
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '8px 14px',
            fontWeight: 600,
            fontSize: 12,
            cursor: 'not-allowed',
            opacity: generating ? 0.7 : 0.85,
          }}
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </NodeCard>
  );
}

function OutputNode({ id, data }: NodeProps<OutputNodeData>) {
  const projectId = useWorkflowStore((s) => s.projectId);
  const setAncestryNodeId = useWorkflowStore((s) => s.setAncestryNodeId);
  const [genCount, setGenCount] = useState<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    fetchLineage(projectId, id).then((gens) => setGenCount(gens.length));
  }, [projectId, id]);

  return (
    <NodeCard
      footer={
        <>
          <span>OUTPUT</span>
          <button
            type="button"
            onClick={() => setAncestryNodeId(id)}
            title="View ancestry"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px',
              color: '#39B27A',
              fontWeight: 700,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            ⌥{genCount !== null && genCount > 0 ? ` ${genCount}` : ''}
          </button>
        </>
      }
      accent="#39B27A"
    >
      <div
        style={{
          minHeight: 90,
          borderRadius: 12,
          background: 'linear-gradient(135deg, #fafafa, #eef0f9)',
          padding: 10,
          fontSize: 12,
          color: 'rgba(15,18,30,0.75)',
          whiteSpace: 'pre-wrap',
        }}
      >
        {data.text || 'Output will appear here.'}
      </div>
    </NodeCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: 'rgba(15,18,30,0.5)' }}>{label}</span>
      <span style={{ color: 'rgba(15,18,30,0.85)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export const nodeTypes: NodeTypes = {
  'text-prompt': TextPromptNode,
  'image-reference': ImageReferenceNode,
  'style-modifier': StyleModifierNode,
  'ai-model': AiModelNode,
  output: OutputNode,
};
