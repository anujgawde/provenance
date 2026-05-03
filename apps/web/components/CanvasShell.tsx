'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnect,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getSocket } from '@/lib/socket';
import { getLocalUser, newId } from '@/lib/identity';
import { useWorkflowStore } from '@/store/useWorkflow';
import type {
  AiModelNodeData,
  ImageReferenceNodeData,
  NodeKind,
  Operation,
  OutputNodeData,
  PresenceUser,
  StyleModifierNodeData,
  TextPromptNodeData,
  WorkflowEdge,
  WorkflowNode,
} from '@provenance/shared';
import { TopBar } from './TopBar';
import { LeftToolbar, type ToolbarMode } from './LeftToolbar';
import { BottomControls, UpgradePill } from './BottomControls';
import { nodeTypes } from './NodeTypes';
import { Cursors } from './Cursors';
import { AncestryPanel } from './AncestryPanel';
import { CompareOverlay } from './CompareOverlay';
import { ConnectionBanner } from './ConnectionBanner';
import { ToastContainer } from './Toast';

const CURSOR_THROTTLE_MS = 60;

function defaultDataFor(kind: NodeKind):
  | TextPromptNodeData
  | ImageReferenceNodeData
  | StyleModifierNodeData
  | AiModelNodeData
  | OutputNodeData {
  switch (kind) {
    case 'text-prompt':
      return { text: 'A modern building with parametric glass facade' };
    case 'image-reference':
      return { url: '' };
    case 'style-modifier':
      return { style: 'piranesi etching', weight: 0.8 };
    case 'ai-model':
      return {
        model: { provider: 'anthropic', model: 'claude-opus-4-7' },
        systemPrompt: 'Describe an architectural rendering.',
        status: 'idle',
      };
    case 'output':
      return { text: '' };
  }
}

function toRfNode(n: WorkflowNode): Node {
  return { id: n.id, type: n.type, position: n.position, data: n.data };
}

function toRfEdge(e: WorkflowEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  };
}

function CanvasInner({ projectId }: { projectId: string }) {
  const me = useMemo(() => getLocalUser(), []);
  const [, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [boardName, setBoardName] = useState('Template');
  const [mode, setMode] = useState<ToolbarMode>('select');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const workflow = useWorkflowStore((s) => s.workflow);
  const users = useWorkflowStore((s) => s.users);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const setUsers = useWorkflowStore((s) => s.setUsers);
  const setProjectId = useWorkflowStore((s) => s.setProjectId);
  const applyRemoteOp = useWorkflowStore((s) => s.applyRemoteOp);
  const upsertNode = useWorkflowStore((s) => s.upsertNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNode = useWorkflowStore((s) => s.updateNode);
  const upsertEdge = useWorkflowStore((s) => s.upsertEdge);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const setCursor = useWorkflowStore((s) => s.setCursor);
  const dropCursor = useWorkflowStore((s) => s.dropCursor);
  const compareDiff = useWorkflowStore((s) => s.compareDiff);
  const exitCompareMode = useWorkflowStore((s) => s.exitCompareMode);
  const pushUndo = useWorkflowStore((s) => s.pushUndo);
  const popUndo = useWorkflowStore((s) => s.popUndo);
  const selectedNodeIds = useWorkflowStore((s) => s.selectedNodeIds);
  const setSelectedNodeIds = useWorkflowStore((s) => s.setSelectedNodeIds);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastCursorEmit = useRef(0);

  const emit = useCallback((event: Operation['type'], payload: Operation) => {
    getSocket().emit(event as any, payload as any);
  }, []);

  useEffect(() => {
    setProjectId(projectId);
  }, [projectId, setProjectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Escape: exit compare mode or deselect
      if (e.key === 'Escape') {
        if (useWorkflowStore.getState().compareDiff) {
          exitCompareMode();
        } else {
          setSelectedNodeIds([]);
        }
        return;
      }

      if (isInput) return;

      // Delete/Backspace: remove selected nodes
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = useWorkflowStore.getState().selectedNodeIds;
        if (ids.length === 0) return;
        const wf = useWorkflowStore.getState().workflow;
        const undoOps: Operation[] = [];
        ids.forEach((id) => {
          const node = wf.nodes.find((n) => n.id === id);
          if (node) undoOps.push({ type: 'op:node:add', node });
          const connected = wf.edges.filter((ed) => ed.source === id || ed.target === id);
          connected.forEach((ed) => undoOps.push({ type: 'op:edge:add', edge: ed }));
          removeNode(id);
          emit('op:node:remove', { type: 'op:node:remove', nodeId: id });
        });
        if (undoOps.length > 0) pushUndo({ ops: undoOps });
        setSelectedNodeIds([]);
        return;
      }

      // Cmd+Z / Ctrl+Z: undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const entry = popUndo();
        if (!entry) return;
        entry.ops.forEach((op) => {
          switch (op.type) {
            case 'op:node:add':
              upsertNode(op.node);
              emit('op:node:add', op);
              break;
            case 'op:edge:add':
              upsertEdge(op.edge);
              emit('op:edge:add', op);
              break;
            case 'op:node:remove':
              removeNode(op.nodeId);
              emit('op:node:remove', op);
              break;
            case 'op:edge:remove':
              removeEdge(op.edgeId);
              emit('op:edge:remove', op);
              break;
          }
        });
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [exitCompareMode, removeNode, emit, pushUndo, popUndo, upsertNode, upsertEdge, removeEdge, setSelectedNodeIds]);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => {
      setStatus('connected');
      socket.emit('session:join', { projectId, user: me }, (resp) => {
        if (!resp.ok) {
          console.warn('join failed', resp.error);
          return;
        }
        setWorkflow(resp.state.workflow);
        setUsers(resp.state.users);
      });
    };
    const onDisconnect = () => setStatus('disconnected');
    const onUsers = (us: PresenceUser[]) => {
      setUsers(us);
      // Cursors only purge when a user disconnects (not by staleness):
      // drop any cursor whose userId is no longer present in the room.
      const liveIds = new Set(us.map((u) => u.id));
      const cursors = useWorkflowStore.getState().cursors;
      Object.keys(cursors).forEach((id) => {
        if (!liveIds.has(id)) dropCursor(id);
      });
    };
    const onCursor = (p: { userId: string; x: number; y: number }) => {
      if (p.userId === me.id) return;
      setCursor({ userId: p.userId, x: p.x, y: p.y, ts: Date.now() });
    };

    if (socket.connected) onConnect();
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('session:users', onUsers);
    socket.on('cursor:move', onCursor);

    const opEvents: Operation['type'][] = [
      'op:node:add',
      'op:node:remove',
      'op:node:update',
      'op:edge:add',
      'op:edge:remove',
    ];
    const handlers = opEvents.map((ev) => {
      const handler = (op: any) => applyRemoteOp(op);
      socket.on(ev as any, handler);
      return [ev, handler] as const;
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('session:users', onUsers);
      socket.off('cursor:move', onCursor);
      handlers.forEach(([ev, h]) => socket.off(ev as any, h as any));
    };
  }, [projectId, me, setWorkflow, setUsers, setCursor, applyRemoteOp, dropCursor]);

  const rfNodes = useMemo(() => workflow.nodes.map(toRfNode), [workflow.nodes]);
  const rfEdges = useMemo(() => workflow.edges.map(toRfEdge), [workflow.edges]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const current = workflow.nodes.map(toRfNode);
      void applyNodeChanges(changes, current);
      changes.forEach((ch) => {
        if (ch.type === 'position' && ch.position) {
          updateNode(ch.id, { position: ch.position });
          emit('op:node:update', {
            type: 'op:node:update',
            nodeId: ch.id,
            changes: { position: ch.position },
          });
        } else if (ch.type === 'remove') {
          const node = workflow.nodes.find((n) => n.id === ch.id);
          const undoOps: Operation[] = [];
          if (node) undoOps.push({ type: 'op:node:add', node });
          const connected = workflow.edges.filter((e) => e.source === ch.id || e.target === ch.id);
          connected.forEach((e) => undoOps.push({ type: 'op:edge:add', edge: e }));
          if (undoOps.length > 0) pushUndo({ ops: undoOps });
          removeNode(ch.id);
          emit('op:node:remove', { type: 'op:node:remove', nodeId: ch.id });
        }
      });
    },
    [workflow.nodes, workflow.edges, updateNode, removeNode, emit, pushUndo],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const current = workflow.edges.map(toRfEdge);
      void applyEdgeChanges(changes, current);
      changes.forEach((ch) => {
        if (ch.type === 'remove') {
          removeEdge(ch.id);
          emit('op:edge:remove', { type: 'op:edge:remove', edgeId: ch.id });
        }
      });
    },
    [workflow.edges, removeEdge, emit],
  );

  const onConnect: OnConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return;
      const edge: WorkflowEdge = {
        id: newId(),
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? null,
        targetHandle: conn.targetHandle ?? null,
      };
      upsertEdge(edge);
      emit('op:edge:add', { type: 'op:edge:add', edge });
    },
    [upsertEdge, emit],
  );

  const handleAddNode = useCallback(
    (kind: NodeKind) => {
      const node: WorkflowNode = {
        id: newId(),
        type: kind,
        position: { x: 240 + Math.random() * 200, y: 160 + Math.random() * 200 },
        data: defaultDataFor(kind) as any,
      };
      upsertNode(node);
      emit('op:node:add', { type: 'op:node:add', node });
    },
    [upsertNode, emit],
  );

  const onSelectionChange = useCallback(
    ({ nodes }: { nodes: Node[] }) => {
      setSelectedNodeIds(nodes.map((n) => n.id));
    },
    [setSelectedNodeIds],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastCursorEmit.current < CURSOR_THROTTLE_MS) return;
    lastCursorEmit.current = now;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const bounds = wrapper.getBoundingClientRect();
    const rfPane = wrapper.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!rfPane) return;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rfPane).transform);
    const screenX = e.clientX - bounds.left;
    const screenY = e.clientY - bounds.top;
    const zoom = matrix.a || 1;
    const flowX = (screenX - matrix.e) / zoom;
    const flowY = (screenY - matrix.f) / zoom;
    getSocket().volatile.emit('cursor:move', { x: flowX, y: flowY });
  }, []);

  const isDark = theme === 'dark';
  const canvasBg = isDark ? '#0f121e' : '#fafbff';
  const dotColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,18,30,0.12)';

  return (
    <div
      ref={wrapperRef}
      onPointerMove={onPointerMove}
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
      <div
        style={{
          width: '100%',
          height: '100%',
          opacity: compareDiff ? 0.55 : 1,
          transition: 'opacity 200ms',
        }}
      >
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          proOptions={{ hideAttribution: true }}
          fitView
          style={{ background: canvasBg }}
        >
          <Background gap={24} size={1.4} color={dotColor} />
        </ReactFlow>
      </div>
      <CompareOverlay />
      <Cursors />
      <TopBar name={boardName} onRename={setBoardName} />
      <PresenceStack users={users} />
      <LeftToolbar
        mode={mode}
        setMode={setMode}
        userInitial={me.name.slice(0, 1).toUpperCase()}
        userColor={me.color}
        onAddNode={handleAddNode}
        theme={theme}
      />
      <BottomControls theme={theme} setTheme={setTheme} />
      <UpgradePill />
      <AncestryPanel projectId={projectId} />
      <ConnectionBanner />
      <ToastContainer />
    </div>
  );
}

function PresenceStack({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 22,
        right: 70,
        zIndex: 30,
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      {users.map((u, idx) => (
        <div
          key={u.id}
          title={u.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: u.color,
            color: '#fff',
            border: '2px solid #fff',
            marginLeft: idx === 0 ? 0 : -8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(15,18,30,0.10)',
          }}
        >
          {u.name.slice(0, 1).toUpperCase()}
        </div>
      ))}
    </div>
  );
}

export function CanvasShell({ projectId }: { projectId: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    // Avoid SSR/CSR mismatch: identity is localStorage-backed and React Flow
    // is client-only. Render nothing until after mount.
    return <div style={{ height: '100vh', width: '100vw', background: '#fafbff' }} />;
  }
  return (
    <ReactFlowProvider>
      <CanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
