'use client';

import { useViewport } from 'reactflow';
import { useWorkflowStore } from '@/store/useWorkflow';

export function Cursors() {
  const cursors = useWorkflowStore((s) => s.cursors);
  const users = useWorkflowStore((s) => s.users);
  const { x: vx, y: vy, zoom } = useViewport();

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
      {Object.values(cursors).map((c) => {
        const u = users.find((u) => u.id === c.userId);
        if (!u) return null;
        const screenX = c.x * zoom + vx;
        const screenY = c.y * zoom + vy;
        return (
          <div
            key={c.userId}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              transform: 'translate(-2px, -2px)',
              transition: 'left 60ms linear, top 60ms linear',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M2 2 L2 14 L6 10 L9 16 L11 15 L8 9 L14 9 Z"
                fill={u.color}
                stroke="#fff"
                strokeWidth="1"
              />
            </svg>
            <div
              style={{
                marginTop: 2,
                padding: '2px 6px',
                background: u.color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 6,
                whiteSpace: 'nowrap',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {u.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
