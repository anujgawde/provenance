'use client';

import { forwardRef, useMemo, useRef, useState } from 'react';
import type { NodeKind } from '@provenance/shared';
import { AddNodePopover } from './AddNodePopover';
import {
  ChatIcon,
  CubeIcon,
  EraserIcon,
  EyeIcon,
  EyeOffIcon,
  FrameIcon,
  HistoryIcon,
  PencilIcon,
  PlusIcon,
  RouteIcon,
  ScribbleIcon,
  StickerIcon,
  TextIcon,
  WrenchIcon,
  XLogoIcon,
} from './icons';

export type ToolbarMode = 'select' | 'draw' | 'view';

const ACCENT_BG = 'rgba(63, 63, 224, 0.10)';
const ACCENT_FG = '#3F3FE0';

export function LeftToolbar({
  mode,
  setMode,
  userInitial = 'A',
  userColor = '#7E8794',
  onAddNode,
  theme = 'light',
}: {
  mode: ToolbarMode;
  setMode: (m: ToolbarMode) => void;
  userInitial?: string;
  userColor?: string;
  onAddNode?: (kind: NodeKind) => void;
  theme?: 'light' | 'dark';
}) {
  const [addOpen, setAddOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);

  const drawItems = useMemo(
    () => [
      { key: 'pencil', icon: <PencilIcon width={18} height={18} />, label: 'Pencil' },
      { key: 'eraser', icon: <EraserIcon width={18} height={18} />, label: 'Eraser' },
      { key: 'cube', icon: <CubeIcon width={18} height={18} />, label: '3D' },
      { key: 'text', icon: <TextIcon width={18} height={18} />, label: 'Text' },
      { key: 'frame', icon: <FrameIcon width={18} height={18} />, label: 'Frame' },
    ],
    [],
  );
  const viewItems = useMemo(
    () => [
      { key: 'comment', icon: <ChatIcon width={18} height={18} />, label: 'Comment' },
      { key: 'sticker', icon: <StickerIcon width={18} height={18} />, label: 'Sticker' },
      { key: 'hide', icon: <EyeOffIcon width={18} height={18} />, label: 'Hide' },
    ],
    [],
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: 18,
        transform: 'translateY(-50%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        alignItems: 'center',
      }}
    >
      <Pill>
        <ToolButton
          active={mode === 'select'}
          onClick={() => {
            setMode('select');
            setAddOpen(false);
          }}
          title="Select"
          icon={<XLogoIcon width={18} height={18} />}
        />
        <ToolButton
          active={mode === 'draw'}
          onClick={() => {
            setMode('draw');
            setAddOpen(false);
          }}
          title="Draw"
          icon={<ScribbleIcon width={18} height={18} />}
        />
        <ToolButton
          active={mode === 'view'}
          onClick={() => {
            setMode('view');
            setAddOpen(false);
          }}
          title="View"
          icon={<EyeIcon width={18} height={18} />}
        />
      </Pill>
      <Pill>
        {mode === 'select' && (
          <>
            <ToolButton
              ref={addBtnRef}
              active={addOpen}
              onClick={() => setAddOpen((o) => !o)}
              title="Add node"
              icon={<PlusIcon width={18} height={18} />}
            />
            <ToolButton title="Tools" icon={<WrenchIcon width={18} height={18} />} />
            <ToolButton title="Route" icon={<RouteIcon width={18} height={18} />} />
            <ToolButton title="History" icon={<HistoryIcon width={18} height={18} />} />
          </>
        )}
        {mode === 'draw' &&
          drawItems.map((it) => <ToolButton key={it.key} title={it.label} icon={it.icon} />)}
        {mode === 'view' &&
          viewItems.map((it) => <ToolButton key={it.key} title={it.label} icon={it.icon} />)}
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: userColor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 4,
          }}
        >
          {userInitial}
        </div>
      </Pill>
      <AddNodePopover
        open={addOpen && mode === 'select'}
        onClose={() => setAddOpen(false)}
        onPick={(kind) => onAddNode?.(kind)}
        anchorRef={addBtnRef}
        theme={theme}
      />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: 6,
        background: 'rgba(232, 234, 240, 0.85)',
        borderRadius: 999,
        boxShadow: '0 1px 2px rgba(15,18,30,0.04)',
      }}
    >
      {children}
    </div>
  );
}

const ToolButton = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
    title: string;
  }
>(function ToolButton({ icon, active, onClick, title }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: 'none',
        background: active ? ACCENT_BG : 'transparent',
        color: active ? ACCENT_FG : 'rgba(15,18,30,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => {
        if (!active)
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(15,18,30,0.05)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      {icon}
    </button>
  );
});
