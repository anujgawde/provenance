'use client';

import { useEffect, useState } from 'react';
import { getSocket } from '@/lib/socket';

export function ConnectionBanner() {
  const [disconnected, setDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const onDisconnect = () => {
      setDisconnected(true);
      setReconnecting(true);
    };
    const onConnect = () => {
      setDisconnected(false);
      setReconnecting(false);
    };
    const onReconnectAttempt = () => setReconnecting(true);
    const onReconnectFailed = () => setReconnecting(false);

    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect_failed', onReconnectFailed);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, []);

  if (!disconnected) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#dc2626',
        color: '#fff',
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 4, background: '#fca5a5', display: 'inline-block' }} />
      {reconnecting ? 'Connection lost. Reconnecting…' : 'Disconnected from server. Please refresh.'}
    </div>
  );
}
