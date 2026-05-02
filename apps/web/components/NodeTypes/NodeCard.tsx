'use client';

import type { ReactNode } from 'react';
import { Handle, Position } from 'reactflow';

const portStyle = {
  width: 10,
  height: 10,
  background: '#fff',
  border: '1.5px solid rgba(63, 63, 224, 0.6)',
};

export function NodeCard({
  children,
  footer,
  width = 260,
  accent,
}: {
  children: ReactNode;
  footer: ReactNode;
  width?: number;
  accent?: string;
}) {
  return (
    <div
      style={{
        width,
        background: '#fff',
        border: '1px solid rgba(15, 18, 30, 0.08)',
        borderRadius: 18,
        boxShadow: '0 6px 18px rgba(15, 18, 30, 0.06)',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {accent && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: accent,
          }}
        />
      )}
      <Handle type="target" position={Position.Left} style={portStyle} />
      <Handle type="target" position={Position.Top} style={portStyle} />
      <Handle type="source" position={Position.Right} style={portStyle} />
      <Handle type="source" position={Position.Bottom} style={portStyle} />
      <div style={{ padding: 14 }}>{children}</div>
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(15, 18, 30, 0.06)',
          fontSize: 11,
          letterSpacing: 0.4,
          color: 'rgba(15, 18, 30, 0.6)',
          textTransform: 'uppercase',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {footer}
      </div>
    </div>
  );
}
