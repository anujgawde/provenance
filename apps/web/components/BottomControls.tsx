'use client';

import { useEffect, useState } from 'react';
import { MiniMap, useReactFlow, useViewport } from 'reactflow';
import { MoonIcon, RecenterIcon, SunIcon } from './icons';

export function BottomControls({
  theme,
  setTheme,
}: {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}) {
  const { zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const { zoom } = useViewport();
  const [hovering, setHovering] = useState(false);

  const pct = Math.round(zoom * 100);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 18,
        right: 18,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <CircleButton
        title="Recenter"
        onClick={() => {
          setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 250 });
          fitView({ duration: 250, padding: 0.2 });
        }}
      >
        <RecenterIcon width={16} height={16} />
      </CircleButton>
      <CircleButton
        title="Toggle theme"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        {theme === 'light' ? <MoonIcon width={16} height={16} /> : <SunIcon width={16} height={16} />}
      </CircleButton>
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        style={{ position: 'relative' }}
      >
        {hovering && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              right: 0,
              width: 200,
              height: 130,
              background: '#fff',
              border: '1px solid rgba(15,18,30,0.08)',
              borderRadius: 14,
              boxShadow: '0 12px 32px rgba(15, 18, 30, 0.10)',
              padding: 8,
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 8 }}>
              <MiniMap
                style={{ width: '100%', height: '100%', background: 'transparent' }}
                pannable
                zoomable
                maskColor="rgba(63,63,224,0.08)"
                nodeColor={() => '#3F3FE0'}
              />
            </div>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid rgba(15,18,30,0.08)',
            borderRadius: 999,
            padding: '6px 10px',
            boxShadow: '0 6px 18px rgba(15, 18, 30, 0.06)',
            fontSize: 13,
            fontFamily: 'inherit',
            color: '#0f121e',
          }}
        >
          <button
            type="button"
            onClick={() => zoomOut({ duration: 150 })}
            style={miniBtn}
            aria-label="Zoom out"
          >
            −
          </button>
          <span style={{ minWidth: 38, textAlign: 'center', fontWeight: 600 }}>{pct}%</span>
          <button
            type="button"
            onClick={() => zoomIn({ duration: 150 })}
            style={miniBtn}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
  color: '#0f121e',
  width: 14,
  padding: 0,
};

function CircleButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        background: '#fff',
        border: '1px solid rgba(15,18,30,0.08)',
        boxShadow: '0 6px 18px rgba(15, 18, 30, 0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#0f121e',
      }}
    >
      {children}
    </button>
  );
}

export function UpgradePill() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 18,
        left: 18,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 6px 6px 14px',
        borderRadius: 999,
        background: '#3F3FE0',
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 8px 22px rgba(63, 63, 224, 0.35)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 5 C 9 9, 15 9, 19 5" />
          <path d="M5 19 C 9 15, 15 15, 19 19" />
          <path d="M5 5 C 9 9, 9 15, 5 19" />
          <path d="M19 5 C 15 9, 15 15, 19 19" />
        </svg>
        25
      </span>
      <button
        type="button"
        style={{
          background: '#fff',
          color: '#3F3FE0',
          border: 'none',
          borderRadius: 999,
          padding: '5px 12px',
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Upgrade
      </button>
    </div>
  );
}
