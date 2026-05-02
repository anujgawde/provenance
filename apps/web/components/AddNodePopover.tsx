'use client';

import { useEffect, useRef, useState } from 'react';
import type { NodeKind } from '@provenance/shared';
import {
  CubeIcon,
  EraserIcon,
  FrameIcon,
  PencilIcon,
  SparkleIcon,
  TextIcon,
} from './icons';

interface Row {
  kind: NodeKind;
  label: string;
  icon: React.ReactNode;
}

const ROWS: Row[] = [
  { kind: 'text-prompt', label: 'Text Prompt', icon: <TextIcon width={16} height={16} /> },
  { kind: 'image-reference', label: 'Image Reference', icon: <FrameIcon width={16} height={16} /> },
  { kind: 'ai-model', label: 'AI Model', icon: <SparkleIcon width={16} height={16} /> },
  { kind: 'style-modifier', label: 'Style Modifier', icon: <PencilIcon width={16} height={16} /> },
  { kind: 'output', label: 'Output', icon: <CubeIcon width={16} height={16} /> },
];

const ACCENT = '#3F3FE0';

export function AddNodePopover({
  open,
  onClose,
  onPick,
  anchorRef,
  theme,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: NodeKind) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  theme: 'light' | 'dark';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<NodeKind | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current || !anchorRef.current) return;
      const t = e.target as Node;
      if (ref.current.contains(t) || anchorRef.current.contains(t)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const isDark = theme === 'dark';
  const panelBg = isDark ? 'rgba(20, 22, 32, 0.92)' : '#fff';
  const panelBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,18,30,0.08)';
  const panelShadow = isDark
    ? '0 18px 40px rgba(0, 0, 0, 0.45)'
    : '0 12px 32px rgba(15, 18, 30, 0.10)';
  const headerColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,18,30,0.55)';
  const labelColor = isDark ? 'rgba(255,255,255,0.85)' : '#0f121e';
  const tileBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,18,30,0.04)';
  const tileFg = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,18,30,0.7)';

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        // Anchor to the right of the toolbar pill (toolbar starts at left:18 with width ~44)
        left: 70,
        top: '50%',
        transform: 'translateY(-30%)',
        width: 240,
        background: panelBg,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: panelBorder,
        borderRadius: 14,
        boxShadow: panelShadow,
        padding: 10,
        zIndex: 40,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          padding: '4px 6px 8px',
          fontSize: 12,
          fontWeight: 600,
          color: headerColor,
          letterSpacing: 0.2,
        }}
      >
        Generate
      </div>
      {ROWS.map((row) => {
        const active = hover === row.kind;
        return (
          <button
            type="button"
            key={row.kind}
            onMouseEnter={() => setHover(row.kind)}
            onMouseLeave={() => setHover((h) => (h === row.kind ? null : h))}
            onClick={() => {
              onPick(row.kind);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '8px 8px',
              background: 'transparent',
              border: active ? `1.5px solid ${ACCENT}` : '1.5px solid transparent',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: labelColor,
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: tileBg,
                color: tileFg,
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {row.icon}
            </span>
            {row.label}
          </button>
        );
      })}
    </div>
  );
}
