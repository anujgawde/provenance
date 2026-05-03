'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeProps, NodeTypes } from 'reactflow';
import type {
  AiModelNodeData,
  ImageReferenceNodeData,
  OutputNodeData,
  StyleModifierNodeData,
  TextPromptNodeData,
} from '@provenance/shared';
import { useWorkflowStore } from '@/store/useWorkflow';
import { getSocket } from '@/lib/socket';
import { fetchLineages } from '@/lib/api';
import { NodeCard } from './NodeCard';

const ACCENT = '#3F3FE0';

function useInlineEdit(
  nodeId: string,
  currentText: string,
  field: string,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentText);
  const ref = useRef<HTMLTextAreaElement>(null);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  useEffect(() => {
    if (!editing) setDraft(currentText);
  }, [currentText, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft === currentText) return;
    const data = { [field]: draft };
    updateNode(nodeId, { data });
    getSocket().emit('op:node:update', {
      type: 'op:node:update',
      nodeId,
      changes: { data },
    });
  }, [draft, currentText, field, nodeId, updateNode]);

  return { editing, draft, ref, setEditing, setDraft, commit };
}

function TextPromptNode({ id, data }: NodeProps<TextPromptNodeData>) {
  const { editing, draft, ref, setEditing, setDraft, commit } = useInlineEdit(
    id,
    data.text,
    'text',
  );

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
      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commit();
          }}
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: 'rgba(15,18,30,0.85)',
            minHeight: 64,
            width: '100%',
            resize: 'vertical',
            border: '1.5px solid rgba(99,102,241,0.4)',
            borderRadius: 8,
            padding: 6,
            background: '#fafbff',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: 'rgba(15,18,30,0.85)',
            minHeight: 64,
            whiteSpace: 'pre-wrap',
            cursor: 'text',
          }}
          title="Double-click to edit"
        >
          {data.text || 'Double-click to type a prompt…'}
        </div>
      )}
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

function AiModelNode({ id, data }: NodeProps<AiModelNodeData>) {
  const generating = data.status === 'generating';

  const handleGenerate = useCallback(() => {
    if (generating) return;
    const prompt = data.systemPrompt || 'Generate a creative output';
    getSocket().emit('generate:request', {
      aiNodeId: id,
      input: { prompt, system: data.systemPrompt },
    }, (resp) => {
      if (!resp.ok) {
        console.warn('generate failed:', resp.error);
      }
    });
  }, [id, data.systemPrompt, generating]);

  return (
    <NodeCard
      width={280}
      footer={
        <>
          <span>AI · {data.model?.model ?? 'Claude'}</span>
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
          disabled={generating}
          onClick={handleGenerate}
          style={{
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '8px 14px',
            fontWeight: 600,
            fontSize: 12,
            cursor: generating ? 'wait' : 'pointer',
            opacity: generating ? 0.7 : 1,
            transition: 'opacity 200ms',
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

  const { editing, draft, ref, setEditing, setDraft, commit } = useInlineEdit(
    id,
    data.text ?? '',
    'text',
  );

  useEffect(() => {
    if (!projectId) return;
    fetchLineages(projectId, id).then((records) => setGenCount(records.length));
  }, [projectId, id, data.text]);

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
      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') commit();
          }}
          style={{
            minHeight: 90,
            width: '100%',
            resize: 'vertical',
            borderRadius: 12,
            border: '1.5px solid rgba(57,178,122,0.4)',
            background: '#fafbff',
            padding: 10,
            fontSize: 12,
            color: 'rgba(15,18,30,0.75)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{
            minHeight: 90,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #fafafa, #eef0f9)',
            padding: 10,
            fontSize: 12,
            color: 'rgba(15,18,30,0.75)',
            whiteSpace: 'pre-wrap',
            cursor: 'text',
          }}
          title="Double-click to edit"
        >
          {data.text || 'Double-click to edit output.'}
        </div>
      )}
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
