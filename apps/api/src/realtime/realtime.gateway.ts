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
import { LineageService } from '../capture/lineage.service';
import { UpstreamService } from '../capture/upstream.service';
import { AiService } from '../ai/ai.service';

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

  constructor(
    _config: ConfigService,
    private readonly capture: CaptureService,
    private readonly lineageService: LineageService,
    private readonly upstream: UpstreamService,
    private readonly ai: AiService,
  ) {}

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
    let entryId: string | null = null;
    try {
      const entry = this.capture.capture(meta.projectId, project.workflow, op);
      entryId = entry?.id ?? null;
    } catch (err) {
      this.logger.warn(`capture failed for ${op.type}: ${(err as Error).message}`);
    }
    this.applyOp(project.workflow, op);
    // Bit 5: attach full post-op workflow snapshot to output-node updates.
    // We snapshot every update on output nodes (cheap; workflow is small) so
    // every row the ancestry panel lists has a snapshot graph-diff can use.
    if (entryId && op.type === 'op:node:update') {
      const node = project.workflow.nodes.find((n) => n.id === op.nodeId);
      if (node?.type === 'output') {
        try {
          this.capture.attachWorkflowSnapshot(entryId, project.workflow);
        } catch (err) {
          this.logger.warn(`snapshot attach failed: ${(err as Error).message}`);
        }
      }
    }
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

  @SubscribeMessage('generate:request')
  async onGenerate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { aiNodeId: string; input: import('@provenance/shared').AiGenerationInput },
  ) {
    const meta = this.socketProject.get(client.id);
    if (!meta) return { ok: false as const, error: 'not in a session' };

    const project = this.getProject(meta.projectId);
    const aiNode = project.workflow.nodes.find((n) => n.id === payload.aiNodeId);
    if (!aiNode || aiNode.type !== 'ai-model') {
      return { ok: false as const, error: 'AI model node not found' };
    }

    // Find the downstream output node (target of an edge from this AI node)
    const outputEdge = project.workflow.edges.find((e) => e.source === payload.aiNodeId);
    let outputNode = outputEdge
      ? project.workflow.nodes.find((n) => n.id === outputEdge.target && n.type === 'output')
      : null;

    // If no connected output node, create one
    const { randomUUID } = await import('node:crypto');
    let outputNodeId = outputNode?.id ?? null;
    if (!outputNode) {
      outputNodeId = randomUUID();
      const newOutput: import('@provenance/shared').WorkflowNode = {
        id: outputNodeId!,
        type: 'output',
        position: { x: aiNode.position.x + 340, y: aiNode.position.y },
        data: { text: '' },
      };
      project.workflow.nodes.push(newOutput);
      const newEdge: import('@provenance/shared').WorkflowEdge = {
        id: randomUUID(),
        source: payload.aiNodeId,
        target: outputNodeId!,
        sourceHandle: null,
        targetHandle: null,
      };
      project.workflow.edges.push(newEdge);
      // Broadcast the new node + edge
      const addNodeOp = { type: 'op:node:add' as const, node: newOutput, seq: ++project.seq };
      const addEdgeOp = { type: 'op:edge:add' as const, edge: newEdge, seq: ++project.seq };
      this.server.to(room(meta.projectId)).emit('op:node:add', addNodeOp);
      this.server.to(room(meta.projectId)).emit('op:edge:add', addEdgeOp);
      outputNode = newOutput;
    }

    // Set AI node status to 'generating'
    const aiData = aiNode.data as import('@provenance/shared').AiModelNodeData;
    const statusOp: Extract<import('@provenance/shared').Operation, { type: 'op:node:update' }> = {
      type: 'op:node:update',
      nodeId: payload.aiNodeId,
      changes: { data: { status: 'generating' } },
    };
    this.applyOp(project.workflow, statusOp);
    this.server.to(room(meta.projectId)).emit('op:node:update', { ...statusOp, seq: ++project.seq });

    // Capture lineage (upstream subgraph BEFORE generation)
    const model: import('@provenance/shared').AiModelDescriptor = aiData.model ?? { provider: 'mock', model: 'mock-v1' };
    const lineage = this.lineageService.capture({
      projectId: meta.projectId,
      aiNodeId: payload.aiNodeId,
      outputNodeId: outputNodeId,
      generatedBy: meta.userId,
      model,
      workflow: project.workflow,
      input: payload.input,
    });

    // Get upstream nodes for context
    const upstreamNodes = this.upstream
      .upstreamSubgraph(project.workflow, payload.aiNodeId)
      .nodes;

    try {
      const output = await this.ai.generate(model, payload.input, upstreamNodes);
      this.lineageService.attachOutput(lineage.id, output);

      // Write generated text to the output node
      const updateOp: Extract<import('@provenance/shared').Operation, { type: 'op:node:update' }> = {
        type: 'op:node:update',
        nodeId: outputNodeId!,
        changes: { data: { text: output.text, lineageId: lineage.id } },
      };
      this.applyOp(project.workflow, updateOp);
      this.server.to(room(meta.projectId)).emit('op:node:update', { ...updateOp, seq: ++project.seq });

      // Set AI node status back to 'idle'
      const idleOp: Extract<import('@provenance/shared').Operation, { type: 'op:node:update' }> = {
        type: 'op:node:update',
        nodeId: payload.aiNodeId,
        changes: { data: { status: 'idle' } },
      };
      this.applyOp(project.workflow, idleOp);
      this.server.to(room(meta.projectId)).emit('op:node:update', { ...idleOp, seq: ++project.seq });

      // Broadcast lineage:captured
      lineage.generationOutput = output;
      this.server.to(room(meta.projectId)).emit('lineage:captured', {
        lineage,
        outputNode: project.workflow.nodes.find((n) => n.id === outputNodeId)!,
      });

      return { ok: true as const, lineageId: lineage.id, outputNodeId: outputNodeId! };
    } catch (err) {
      const message = (err as Error).message;
      this.lineageService.attachError(lineage.id, message);
      this.logger.error(`generation failed: ${message}`);

      // Set AI node status to error
      const errOp: Extract<import('@provenance/shared').Operation, { type: 'op:node:update' }> = {
        type: 'op:node:update',
        nodeId: payload.aiNodeId,
        changes: { data: { status: 'error' } },
      };
      this.applyOp(project.workflow, errOp);
      this.server.to(room(meta.projectId)).emit('op:node:update', { ...errOp, seq: ++project.seq });

      return { ok: false as const, error: message };
    }
  }
}
