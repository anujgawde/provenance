'use client';

import { useEffect, useState } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { getSocket } from '@/lib/socket';

const sampleNodes: Node[] = [
  {
    id: 'sample-1',
    position: { x: 80, y: 120 },
    data: { label: 'Text Prompt (placeholder)' },
    type: 'default',
  },
];
const sampleEdges: Edge[] = [];

export function CanvasShell({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      setStatus('connected');
      socket.emit(
        'session:join',
        { projectId, user: { id: socket.id ?? 'anon', name: 'Architect', color: '#7aa2f7' } },
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header
        style={{
          height: 60,
          borderBottom: '1px solid #1f2329',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <strong>Provenance · {projectId}</strong>
        <span style={{ fontSize: 12, opacity: 0.7 }}>socket: {status}</span>
      </header>
      <div style={{ flex: 1 }}>
        <ReactFlow defaultNodes={sampleNodes} defaultEdges={sampleEdges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
