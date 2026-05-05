"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeProps, NodeTypes } from "reactflow";
import type { GenerativeNodeData, NodeKind } from "@provenance/shared";
import { useWorkflowStore } from "@/store/useWorkflow";
import { getSocket } from "@/lib/socket";
import { fetchLineages } from "@/lib/api";
import { useToastStore } from "../Toast";
import { NodeCard } from "./NodeCard";
import {
  SparkleIcon,
  XLogoIcon,
  TextIcon,
  FrameIcon,
  VideoIcon,
  ThreeDIcon,
  InpaintIcon,
  UpscaleIcon,
  WorldLabsIcon,
  DownloadIcon,
  HistoryIcon,
} from "../icons";

const ACCENT = "#3F3FE0";

const NODE_META: Record<
  NodeKind,
  {
    letter: string;
    color: string;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
  }
> = {
  text: {
    letter: "T",
    color: "#B0B4BC",
    label: "Text",
    sublabel: "GPT 5 Nano",
    icon: <TextIcon width={16} height={16} />,
  },
  image: {
    letter: "I",
    color: "#E0653F",
    label: "Image",
    sublabel: "Nano Banana Pro",
    icon: <FrameIcon width={16} height={16} />,
  },
  video: {
    letter: "V",
    color: "#7C5CBF",
    label: "Video",
    sublabel: "ByteDance Seedance",
    icon: <VideoIcon width={16} height={16} />,
  },
  "3d": {
    letter: "3D",
    color: "#39B27A",
    label: "3D",
    sublabel: "Hunyuan",
    icon: <ThreeDIcon width={16} height={16} />,
  },
  inpaint: {
    letter: "IP",
    color: "#C2399F",
    label: "Inpaint",
    sublabel: "Nano Banana Inpaint",
    icon: <InpaintIcon width={16} height={16} />,
  },
  upscale: {
    letter: "U",
    color: "#4BA9C8",
    label: "Upscale",
    sublabel: "Clarity Upscaler",
    icon: <UpscaleIcon width={16} height={16} />,
  },
  "world-labs": {
    letter: "W",
    color: "#2D2D2D",
    label: "World Labs",
    sublabel: "Marble",
    icon: <WorldLabsIcon width={16} height={16} />,
  },
};

function TypeBadge({ letter, bg }: { letter: string; bg: string }) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        background: bg,
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: letter.length > 1 ? 10 : 13,
        fontWeight: 700,
      }}
    >
      {letter}
    </span>
  );
}

function HeaderLabel({
  badge,
  label,
  sublabel,
}: {
  badge: React.ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <>
      {badge}
      <span
        style={{ fontSize: 14, fontWeight: 500, color: "rgba(15,18,30,0.55)" }}
      >
        {label}
      </span>
      {sublabel && (
        <>
          <span style={{ color: "rgba(15,18,30,0.25)", margin: "0 2px" }}>
            |
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(15,18,30,0.4)",
            }}
          >
            {sublabel}
          </span>
        </>
      )}
    </>
  );
}

function BottomToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(232, 234, 240, 0.85)",
        borderRadius: 999,
        padding: "6px 8px",
      }}
    >
      {children}
    </div>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        border: "none",
        background: "transparent",
        color: "rgba(15,18,30,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        fontSize: 16,
      }}
    >
      {children}
    </button>
  );
}

function GenerativeNode({
  id,
  data,
  type,
  selected,
}: NodeProps<GenerativeNodeData>) {
  const kind = type as NodeKind;
  const meta = NODE_META[kind] ?? NODE_META.text;
  const generating = data.status === "generating";
  const isError = data.status === "error";
  const addToast = useToastStore((s) => s.add);
  const projectId = useWorkflowStore((s) => s.projectId);
  const setAncestryNodeId = useWorkflowStore((s) => s.setAncestryNodeId);
  const updateNode = useWorkflowStore((s) => s.updateNode);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.prompt);
  const [genCount, setGenCount] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(data.prompt);
  }, [data.prompt, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!projectId) return;
    fetchLineages(projectId, id).then((records) => setGenCount(records.length));
  }, [projectId, id, data.output]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft === data.prompt) return;
    const changes = { data: { prompt: draft } };
    updateNode(id, changes);
    getSocket().emit("op:node:update", {
      type: "op:node:update",
      nodeId: id,
      changes,
    });
  }, [draft, data.prompt, id, updateNode]);

  const handleGenerate = useCallback(() => {
    if (generating) return;
    const prompt = data.prompt || "Generate a creative output";
    getSocket().emit(
      "generate:request",
      {
        aiNodeId: id,
        input: { prompt, system: "" },
      },
      (resp: { ok: boolean; error?: string }) => {
        if (!resp.ok) {
          addToast(`Generation failed: ${resp.error ?? "Unknown error"}`);
        }
      },
    );
  }, [id, data.prompt, generating, addToast]);

  return (
    <NodeCard
      nodeId={id}
      nodeKind={kind}
      nodeData={data}
      active={!!selected}
      header={
        <HeaderLabel
          badge={
            <TypeBadge
              letter={meta.letter}
              bg={isError ? "#dc2626" : meta.color}
            />
          }
          label={meta.label}
          sublabel={data.model?.model ?? meta.sublabel}
        />
      }
      footer={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div></div>
          {/* <BottomToolbar>
            <ToolbarBtn title="Settings">⚙</ToolbarBtn>
            <ToolbarBtn title="Enhance">
              <SparkleIcon width={16} height={16} />
            </ToolbarBtn>
            <ToolbarBtn title="Output">
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "rgba(15,18,30,0.45)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Output
              </span>
            </ToolbarBtn>
            <ToolbarBtn title="Download">
              <DownloadIcon width={16} height={16} />
            </ToolbarBtn>
          </BottomToolbar> */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {genCount !== null && genCount > 0 && (
              <button
                type="button"
                onClick={() => setAncestryNodeId(id)}
                title="View ancestry"
                style={{
                  background: "none",
                  border: "1px solid rgba(15,18,30,0.1)",
                  borderRadius: 999,
                  cursor: "pointer",
                  padding: "8px 14px",
                  color: meta.color,
                  fontWeight: 700,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "inherit",
                }}
              >
                <HistoryIcon width={14} height={14} />
                {genCount}
              </button>
            )}
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerate}
              style={{
                background: isError ? "#dc2626" : ACCENT,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "10px 20px",
                fontWeight: 700,
                fontSize: 14,
                cursor: generating ? "wait" : "pointer",
                opacity: generating ? 0.7 : 1,
                transition: "opacity 200ms",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "inherit",
                boxShadow: isError
                  ? "0 4px 14px rgba(220,38,38,0.3)"
                  : "0 4px 14px rgba(63, 63, 224, 0.3)",
              }}
            >
              <XLogoIcon width={16} height={16} />
              {generating ? "Generating..." : isError ? "Retry" : "Generate"}
            </button>
          </div>
        </div>
      }
    >
      {editing ? (
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") commit();
          }}
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "rgba(15,18,30,0.85)",
            minHeight: 200,
            width: "100%",
            resize: "vertical",
            border: "none",
            borderRadius: 14,
            padding: 16,
            background: "rgba(235, 238, 248, 0.6)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: data.output ? "rgba(15,18,30,0.75)" : "rgba(15,18,30,0.45)",
            minHeight: 200,
            whiteSpace: "pre-wrap",
            cursor: "text",
            background: data.output
              ? "rgba(63,63,224,0.04)"
              : "rgba(235, 238, 248, 0.6)",
            borderRadius: 14,
            padding: 16,
          }}
          title="Double-click to edit"
        >
          {data.output || data.prompt || "Insert prompt here..."}
        </div>
      )}
    </NodeCard>
  );
}

export const nodeTypes: NodeTypes = {
  text: GenerativeNode,
  image: GenerativeNode,
  video: GenerativeNode,
  "3d": GenerativeNode,
  inpaint: GenerativeNode,
  upscale: GenerativeNode,
  "world-labs": GenerativeNode,
};
