'use client';

import { useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getSocket } from '@/lib/socket';
import { TopBar } from './TopBar';
import { LeftToolbar, type ToolbarMode } from './LeftToolbar';
import { BottomControls, UpgradePill } from './BottomControls';

const sampleNodes: Node[] = [
  {
    id: 'sample-1',
    position: { x: 80, y: 120 },
    data: { label: 'Text Prompt (placeholder)' },
    type: 'default',
  },
];
const sampleEdges: Edge[] = [];

function CanvasInner({ projectId }: { projectId: string }) {
  const [, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [boardName, setBoardName] = useState('Template');
  const [mode, setMode] = useState<ToolbarMode>('select');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      setStatus('connected');
      socket.emit(
        'session:join',
        { projectId, user: { id: socket.id ?? 'anon', name: 'Architect', color: '#3F3FE0' } },
        (resp) => {
          if (!resp.ok) console.warn('join failed', resp.error);
        },
      );
    };
    const onDisconnect = () => setStatus('disconnected');

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [projectId]);

  const isDark = theme === 'dark';
  const canvasBg = isDark ? '#0f121e' : '#fafbff';
  const dotColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,18,30,0.12)';

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        position: 'relative',
        background: canvasBg,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        color: isDark ? '#f3f4fb' : '#0f121e',
      }}
    >
      <ReactFlow
        defaultNodes={sampleNodes}
        defaultEdges={sampleEdges}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: canvasBg }}
      >
        <Background gap={24} size={1.4} color={dotColor} />
      </ReactFlow>
      <TopBar name={boardName} onRename={setBoardName} />
      <LeftToolbar mode={mode} setMode={setMode} userInitial="A" />
      <BottomControls theme={theme} setTheme={setTheme} />
      <UpgradePill />
    </div>
  );
}

export function CanvasShell({ projectId }: { projectId: string }) {
  return (
    <ReactFlowProvider>
      <CanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
