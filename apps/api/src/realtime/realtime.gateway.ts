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
  Operation,
  PresenceUser,
  ServerToClientEvents,
  SessionState,
  Workflow,
} from '@provenance/shared';
import { CaptureService } from '../capture/capture.service';

const room = (projectId: string) => `project:${projectId}`;

interface ProjectState {
  workflow: Workflow;
  users: Map<string, PresenceUser>;
  seq: number;
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server<ClientToServerEvents, ServerToClientEvents>;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly projects = new Map<string, ProjectState>();
  private readonly socketProject = new Map<string, { projectId: string; userId: string }>();

  constructor(_config: ConfigService, private readonly capture: CaptureService) {}

  private getProject(projectId: string): ProjectState {
    let p = this.projects.get(projectId);
    if (!p) {
      p = { workflow: { nodes: [], edges: [] }, users: new Map(), seq: 0 };
      this.projects.set(projectId, p);
    }
    return p;
  }

  private applyOp(workflow: Workflow, op: Operation): void {
    switch (op.type) {
      case 'op:node:add':
        if (!workflow.nodes.find((n) => n.id === op.node.id)) workflow.nodes.push(op.node);
        break;
      case 'op:node:remove':
        workflow.nodes = workflow.nodes.filter((n) => n.id !== op.nodeId);
        workflow.edges = workflow.edges.filter(
          (e) => e.source !== op.nodeId && e.target !== op.nodeId,
        );
        break;
      case 'op:node:update': {
        const node = workflow.nodes.find((n) => n.id === op.nodeId);
        if (!node) break;
        if (op.changes.position) node.position = op.changes.position;
        if (op.changes.data) node.data = { ...node.data, ...op.changes.data } as typeof node.data;
        break;
      }
      case 'op:edge:add':
        if (!workflow.edges.find((e) => e.id === op.edge.id)) workflow.edges.push(op.edge);
        break;
      case 'op:edge:remove':
        workflow.edges = workflow.edges.filter((e) => e.id !== op.edgeId);
        break;
    }
  }

  handleConnection(client: Socket) {
    this.logger.log(`connect ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`disconnect ${client.id}`);
    const meta = this.socketProject.get(client.id);
    if (!meta) return;
    const project = this.projects.get(meta.projectId);
    if (project) {
      project.users.delete(meta.userId);
      this.server
        .to(room(meta.projectId))
        .emit('session:users', Array.from(project.users.values()));
    }
    this.socketProject.delete(client.id);
  }

  @SubscribeMessage('session:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string; user: PresenceUser },
  ) {
    const project = this.getProject(payload.projectId);
    project.users.set(payload.user.id, payload.user);
    client.join(room(payload.projectId));
    this.socketProject.set(client.id, { projectId: payload.projectId, userId: payload.user.id });
    this.logger.log(`${payload.user.name} joined ${payload.projectId}`);

    const state: SessionState = {
      projectId: payload.projectId,
      workflow: project.workflow,
      lineages: [],
      users: Array.from(project.users.values()),
      lastSeq: project.seq,
    };
    client.to(room(payload.projectId)).emit('session:users', state.users);
    return { ok: true as const, state };
  }

  private relay(client: Socket, op: Operation) {
    const meta = this.socketProject.get(client.id);
    if (!meta) return;
    const project = this.getProject(meta.projectId);
    try {
      this.capture.capture(meta.projectId, project.workflow, op);
    } catch (err) {
      this.logger.warn(`capture failed for ${op.type}: ${(err as Error).message}`);
    }
    this.applyOp(project.workflow, op);
    project.seq += 1;
    const stamped = { ...op, seq: project.seq } as Operation & { seq: number };
    client.to(room(meta.projectId)).emit(op.type as any, stamped as any);
  }

  @SubscribeMessage('op:node:add')
  onNodeAdd(
    @ConnectedSocket() c: Socket,
    @MessageBody() op: Extract<Operation, { type: 'op:node:add' }>,
  ) {
    this.relay(c, op);
  }

  @SubscribeMessage('op:node:remove')
  onNodeRemove(
    @ConnectedSocket() c: Socket,
    @MessageBody() op: Extract<Operation, { type: 'op:node:remove' }>,
  ) {
    this.relay(c, op);
  }

  @SubscribeMessage('op:node:update')
  onNodeUpdate(
    @ConnectedSocket() c: Socket,
    @MessageBody() op: Extract<Operation, { type: 'op:node:update' }>,
  ) {
    this.relay(c, op);
  }

  @SubscribeMessage('op:edge:add')
  onEdgeAdd(
    @ConnectedSocket() c: Socket,
    @MessageBody() op: Extract<Operation, { type: 'op:edge:add' }>,
  ) {
    this.relay(c, op);
  }

  @SubscribeMessage('op:edge:remove')
  onEdgeRemove(
    @ConnectedSocket() c: Socket,
    @MessageBody() op: Extract<Operation, { type: 'op:edge:remove' }>,
  ) {
    this.relay(c, op);
  }

  @SubscribeMessage('cursor:move')
  onCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { x: number; y: number },
  ) {
    const meta = this.socketProject.get(client.id);
    if (!meta) return;
    client.to(room(meta.projectId)).volatile.emit('cursor:move', {
      userId: meta.userId,
      x: payload.x,
      y: payload.y,
    });
  }
}
