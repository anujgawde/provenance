import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import type {
  ClientToServerEvents,
  PresenceUser,
  ServerToClientEvents,
  SessionState,
} from '@provenance/shared';

const room = (projectId: string) => `project:${projectId}`;

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(_config: ConfigService) {}

  handleConnection(client: Socket) {
    this.logger.log(`connect ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`disconnect ${client.id}`);
  }

  @SubscribeMessage('session:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string; user: PresenceUser },
  ) {
    client.join(room(payload.projectId));
    this.logger.log(`${payload.user.name} joined ${payload.projectId}`);

    const state: SessionState = {
      projectId: payload.projectId,
      workflow: { nodes: [], edges: [] },
      lineages: [],
      users: [payload.user],
      lastSeq: 0,
    };
    return { ok: true as const, state };
  }
}
