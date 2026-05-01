'use client';

import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@provenance/shared';

export type ProvenanceSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: ProvenanceSocket | null = null;

export function getSocket(): ProvenanceSocket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  socket = io(url, {
    transports: ['websocket'],
    autoConnect: true,
  });
  return socket;
}
