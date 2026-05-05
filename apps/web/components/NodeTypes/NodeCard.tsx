"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Handle, Position } from "reactflow";
import type {
  NodeKind,
  WorkflowEdge,
  WorkflowNode,
  GenerativeNodeData,
} from "@provenance/shared";
import { useWorkflowStore } from "@/store/useWorkflow";
import { getSocket } from "@/lib/socket";
import { newId } from "@/lib/identity";
import {
  TextIcon,
  FrameIcon,
  VideoIcon,
  ThreeDIcon,
  InpaintIcon,
  UpscaleIcon,
  WorldLabsIcon,
} from "../icons";

const HANDLE_BAR_WIDTH = 4;
const HANDLE_BAR_HEIGHT = 20;

const handleBase: React.CSSProperties = {
  width: HANDLE_BAR_WIDTH,
  height: HANDLE_BAR_HEIGHT,
  borderRadius: HANDLE_BAR_WIDTH,
  border: "none",
};

const SPAWN_OPTIONS: { kind: NodeKind; label: string; icon: ReactNode }[] = [
  { kind: "text", label: "Text", icon: <TextIcon width={18} height={18} /> },
  { kind: "image", label: "Image", icon: <FrameIcon width={18} height={18} /> },
  { kind: "video", label: "Video", icon: <VideoIcon width={18} height={18} /> },
  { kind: "3d", label: "3D", icon: <ThreeDIcon width={18} height={18} /> },
  {
    kind: "upscale",
    label: "Upscale",
    icon: <UpscaleIcon width={18} height={18} />,
  },
  {
    kind: "inpaint",
    label: "Inpaint",
    icon: <InpaintIcon width={18} height={18} />,
  },
  {
    kind: "world-labs",
    label: "World Labs",
    icon: <WorldLabsIcon width={18} height={18} />,
  },
];

function defaultGenerativeData(sourcePrompt?: string): GenerativeNodeData {
  return {
    prompt: sourcePrompt ?? "",
    status: "idle",
  };
}

function OutputHandlePopover({
  sourceNodeId,
  sourceNodeKind,
  sourceData,
  onClose,
}: {
  sourceNodeId: string;
  sourceNodeKind: NodeKind;
  sourceData: GenerativeNodeData;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<NodeKind | null>(null);
  const upsertNode = useWorkflowStore((s) => s.upsertNode);
  const upsertEdge = useWorkflowStore((s) => s.upsertEdge);
  const workflow = useWorkflowStore((s) => s.workflow);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handlePick = useCallback(
    (kind: NodeKind) => {
      const sourceNode = workflow.nodes.find((n) => n.id === sourceNodeId);
      const sourceX = sourceNode?.position.x ?? 300;
      const sourceY = sourceNode?.position.y ?? 200;

      const newNodeId = newId();
      const node: WorkflowNode = {
        id: newNodeId,
        type: kind,
        position: { x: sourceX + 420, y: sourceY },
        data: defaultGenerativeData(sourceData.prompt),
      };
      const targetHandle = sourceNodeKind === "text" ? "prompt" : "image";
      const edge: WorkflowEdge = {
        id: newId(),
        source: sourceNodeId,
        target: newNodeId,
        sourceHandle: null,
        targetHandle,
      };

      upsertNode(node);
      upsertEdge(edge);
      getSocket().emit("op:node:add", { type: "op:node:add", node });
      getSocket().emit("op:edge:add", { type: "op:edge:add", edge });
      onClose();
    },
    [
      sourceNodeId,
      sourceData.prompt,
      workflow.nodes,
      upsertNode,
      upsertEdge,
      onClose,
    ],
  );

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        right: -190,
        top: "50%",
        transform: "translateY(-50%)",
        width: 170,
        background: "#fff",
        border: "1px solid rgba(15,18,30,0.08)",
        borderRadius: 14,
        boxShadow: "0 12px 32px rgba(15,18,30,0.10)",
        padding: 6,
        zIndex: 50,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {SPAWN_OPTIONS.map((opt) => {
        const active = hover === opt.kind;
        return (
          <button
            type="button"
            key={opt.kind}
            onMouseEnter={() => setHover(opt.kind)}
            onMouseLeave={() => setHover((h) => (h === opt.kind ? null : h))}
            onClick={() => handlePick(opt.kind)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 10px",
              background: "transparent",
              border: active
                ? "1.5px solid #3F3FE0"
                : "1.5px solid transparent",
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "#0f121e",
              fontSize: 14,
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(15,18,30,0.04)",
                color: "rgba(15,18,30,0.7)",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {opt.icon}
            </span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ClickableSourceHandle({
  color,
  onHandleClick,
}: {
  color: string;
  onHandleClick: () => void;
}) {
  const downPos = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      style={{
        position: "absolute",
        right: -2,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10,
      }}
      onMouseDown={(e) => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={(e) => {
        if (!downPos.current) return;
        const dx = Math.abs(e.clientX - downPos.current.x);
        const dy = Math.abs(e.clientY - downPos.current.y);
        downPos.current = null;
        if (dx < 5 && dy < 5) {
          e.stopPropagation();
          onHandleClick();
        }
      }}
    >
      <Handle
        type="source"
        position={Position.Right}
        style={{
          ...handleBase,
          background: color,
          cursor: "pointer",
        }}
      />
    </div>
  );
}

function HandleWithLabel({
  handle,
  topPercent,
}: {
  handle: { id: string; color: string; label: string };
  topPercent: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      key={handle.id}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        id={handle.id}
        style={{
          ...handleBase,
          background: handle.color,
          top: `${topPercent}%`,
          cursor: "pointer",
        }}
      />
      {hovered && (
        <span
          style={{
            position: "absolute",
            left: -8,
            top: `${topPercent}%`,
            transform: "translate(-100%, -50%)",
            fontSize: 12,
            fontWeight: 600,
            color: handle.color,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {handle.label}
        </span>
      )}
    </div>
  );
}

export function NodeCard({
  children,
  header,
  footer,
  width = 340,
  inputHandles,
  outputHandle,
  nodeId,
  nodeKind,
  nodeData,
  active = false,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  width?: number;
  inputHandles?: { id: string; color: string; label: string }[];
  outputHandle?: { color: string };
  nodeId?: string;
  nodeKind?: NodeKind;
  nodeData?: GenerativeNodeData;
  active?: boolean;
}) {
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (!active) setPopoverOpen(false);
  }, [active]);

  const defaultInputs: { id: string; color: string; label: string }[] =
    inputHandles ?? [
      { id: "prompt", color: "#E8A23E", label: "Input Prompt" },
      { id: "image", color: "#4BA9C8", label: "Input Image" },
    ];

  return (
    <div style={{ position: "relative", cursor: "default" }}>
      {header && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 10,
            paddingLeft: 4,
          }}
        >
          {header}
        </div>
      )}
      <div
        style={{
          width,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.95), rgba(245,245,248,0.9))",
          border: "1px solid rgba(15, 18, 30, 0.07)",
          borderRadius: 22,
          boxShadow:
            "0 8px 24px rgba(15, 18, 30, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          overflow: "visible",
          position: "relative",
        }}
      >
        {defaultInputs.map((h, i) => {
          const topPercent = ((i + 1) / (defaultInputs.length + 1)) * 100;
          return (
            <HandleWithLabel key={h.id} handle={h} topPercent={topPercent} />
          );
        })}
        <ClickableSourceHandle
          color={outputHandle?.color ?? "#9CA3AF"}
          onHandleClick={() => {
            if (nodeId && nodeData) setPopoverOpen((o) => !o);
          }}
        />
        <div style={{ padding: 18 }}>
          {active ? (
            children
          ) : (
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: nodeData?.output
                  ? "rgba(15,18,30,0.75)"
                  : nodeData?.prompt
                    ? "rgba(15,18,30,0.65)"
                    : "rgba(15,18,30,0.25)",
                minHeight: 200,
                whiteSpace: "pre-wrap",
                borderRadius: 14,
                padding: 16,
                background: nodeData?.output ? "rgba(63,63,224,0.04)" : "transparent",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 8,
                WebkitBoxOrient: "vertical",
              }}
            >
              {nodeData?.output || nodeData?.prompt || "Insert prompt here..."}
            </div>
          )}
        </div>
      </div>
      {active && footer && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 4px",
          }}
        >
          {footer}
        </div>
      )}
      {popoverOpen && nodeId && nodeKind && nodeData && (
        <OutputHandlePopover
          sourceNodeId={nodeId}
          sourceNodeKind={nodeKind}
          sourceData={nodeData}
          onClose={() => setPopoverOpen(false)}
        />
      )}
    </div>
  );
}
