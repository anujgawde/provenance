"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, ReactFlowProvider } from "reactflow";
import "reactflow/dist/style.css";
import { useWorkflowStore } from "@/store/useWorkflow";
import { fetchLineages } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { nodeTypes } from "./NodeTypes";
import {
  diffGraphs,
  type ChangedNode,
  type GenerativeNodeData,
  type GraphDiff,
  type LineageRecord,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
} from "@provenance/shared";
import type { Edge, Node } from "reactflow";
import {
  readField,
  formatValue,
  fieldLabel,
  filterFields,
  KIND_LABEL,
} from "./CompareOverlay";

function toRfNode(n: WorkflowNode): Node {
  return { id: n.id, type: n.type, position: n.position, data: n.data };
}

function toRfEdge(e: WorkflowEdge): Edge {
  return { id: e.id, source: e.source, target: e.target };
}

function SubgraphMini({ subgraph }: { subgraph: Workflow }) {
  const rfNodes = useMemo(() => subgraph.nodes.map(toRfNode), [subgraph.nodes]);
  const rfEdges = useMemo(() => subgraph.edges.map(toRfEdge), [subgraph.edges]);

  if (subgraph.nodes.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(15,18,30,0.3)",
          fontSize: 11,
        }}
      >
        No upstream nodes
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        proOptions={{ hideAttribution: true }}
        fitView
        style={{ background: "#f5f6fa", borderRadius: 12 }}
      >
        <Background gap={20} size={1} color="rgba(15,18,30,0.08)" />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOutputText(lineage: LineageRecord): string {
  if (!lineage.generationOutput) return "";
  return lineage.generationOutput.text ?? "";
}

const DIFF_COLOR = {
  added: {
    accent: "#39B27A",
    bg: "rgba(57,178,122,0.06)",
    border: "rgba(57,178,122,0.15)",
  },
  removed: {
    accent: "#E5484D",
    bg: "rgba(229,72,77,0.06)",
    border: "rgba(229,72,77,0.12)",
  },
  changed: {
    accent: "#F5A524",
    bg: "rgba(245,165,36,0.06)",
    border: "rgba(245,165,36,0.12)",
  },
};

function ViewToggle({
  viewSide,
  onToggle,
}: {
  viewSide: "diff" | "before" | "after";
  onToggle: (side: "diff" | "before" | "after") => void;
}) {
  const sides: Array<{ key: "before" | "diff" | "after"; label: string }> = [
    { key: "before", label: "Before" },
    { key: "diff", label: "Diff" },
    { key: "after", label: "After" },
  ];
  return (
    <div
      style={{
        display: "flex",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(99,102,241,0.25)",
      }}
    >
      {sides.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onToggle(key)}
          style={{
            flex: 1,
            padding: "5px 0",
            fontSize: 10,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            background: viewSide === key ? "#6366F1" : "transparent",
            color: viewSide === key ? "#fff" : "#6366F1",
            transition: "background 150ms, color 150ms",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CompareDetails({
  diff,
  before,
  after,
  onExit,
  beforeLineageId,
  afterLineageId,
  beforeMeta,
  afterMeta,
  viewSide,
  onToggle,
  onRestore,
}: {
  diff: GraphDiff;
  before: Workflow | null;
  after: Workflow | null;
  onExit: () => void;
  beforeLineageId: string | null;
  afterLineageId: string | null;
  beforeMeta: { generatedBy: string; capturedAt: number } | null;
  afterMeta: { generatedBy: string; capturedAt: number } | null;
  viewSide: "diff" | "before" | "after";
  onToggle: (side: "diff" | "before" | "after") => void;
  onRestore: (lineageId: string) => void;
}) {
  const users = useWorkflowStore((s) => s.users);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const [confirmRestore, setConfirmRestore] = useState<
    "before" | "after" | null
  >(null);

  const beforeMap = new Map((before?.nodes ?? []).map((n) => [n.id, n]));
  const afterMap = new Map((after?.nodes ?? []).map((n) => [n.id, n]));

  const totalChanges =
    diff.nodes.added.length +
    diff.nodes.removed.length +
    diff.nodes.changed.length;

  const renderAuthor = (
    meta: { generatedBy: string; capturedAt: number } | null,
  ) => {
    if (!meta) return null;
    const author = userMap.get(meta.generatedBy);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 10,
          color: "rgba(15,18,30,0.5)",
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: author?.color ?? "#999",
            color: "#fff",
            fontSize: 7,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {(author?.name ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <span>{author?.name ?? meta.generatedBy.slice(0, 6)}</span>
        <span style={{ color: "rgba(15,18,30,0.3)" }}>·</span>
        <span>{formatTime(meta.capturedAt)}</span>
      </div>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Summary header */}
      <div
        style={{
          margin: "10px 12px 0",
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.20)",
          color: "#3730A3",
          fontSize: 11,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600 }}>
            Comparing · {diff.nodes.added.length} added,{" "}
            {diff.nodes.removed.length} removed, {diff.nodes.changed.length}{" "}
            changed
          </span>
          <button
            type="button"
            onClick={onExit}
            style={{
              background: "transparent",
              border: "none",
              color: "#3730A3",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Exit (Esc)
          </button>
        </div>
        {/* Who/when for both sides */}
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#E5484D",
                marginBottom: 2,
              }}
            >
              Before
            </div>
            {renderAuthor(beforeMeta)}
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                color: "#39B27A",
                marginBottom: 2,
              }}
            >
              After
            </div>
            {renderAuthor(afterMeta)}
          </div>
        </div>
      </div>

      {/* Version toggle */}
      <div style={{ margin: "8px 12px 0", flexShrink: 0 }}>
        <ViewToggle viewSide={viewSide} onToggle={onToggle} />
      </div>

      {/* Restore buttons */}
      <div
        style={{ display: "flex", gap: 6, margin: "8px 12px 0", flexShrink: 0 }}
      >
        {beforeLineageId && (
          <button
            type="button"
            onClick={() => {
              if (confirmRestore === "before") {
                onRestore(beforeLineageId);
                setConfirmRestore(null);
              } else {
                setConfirmRestore("before");
              }
            }}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background:
                confirmRestore === "before"
                  ? "#E5484D"
                  : "rgba(229,72,77,0.10)",
              color: confirmRestore === "before" ? "#fff" : "#E5484D",
              transition: "background 150ms, color 150ms",
            }}
          >
            {confirmRestore === "before" ? "Confirm Restore" : "Restore Before"}
          </button>
        )}
        {afterLineageId && (
          <button
            type="button"
            onClick={() => {
              if (confirmRestore === "after") {
                onRestore(afterLineageId);
                setConfirmRestore(null);
              } else {
                setConfirmRestore("after");
              }
            }}
            style={{
              flex: 1,
              padding: "6px 0",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background:
                confirmRestore === "after"
                  ? "#39B27A"
                  : "rgba(57,178,122,0.10)",
              color: confirmRestore === "after" ? "#fff" : "#39B27A",
              transition: "background 150ms, color 150ms",
            }}
          >
            {confirmRestore === "after" ? "Confirm Restore" : "Restore After"}
          </button>
        )}
      </div>

      {/* Section label */}
      <div
        style={{
          padding: "12px 18px 6px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "rgba(15,18,30,0.35)",
          flexShrink: 0,
        }}
      >
        Version Changes · {totalChanges}
      </div>

      {/* Scrollable change list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
        {totalChanges === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              fontSize: 12,
              color: "rgba(15,18,30,0.4)",
            }}
          >
            No differences found.
          </div>
        )}

        {/* Added nodes */}
        {diff.nodes.added.map((id) => {
          const node = afterMap.get(id);
          if (!node) return null;
          const data = node.data as unknown as GenerativeNodeData;
          const c = DIFF_COLOR.added;
          return (
            <DiffCard
              key={`add-${id}`}
              accent={c.accent}
              bg={c.bg}
              border={c.border}
            >
              <DiffBadge color={c.accent}>Added</DiffBadge>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f121e",
                  marginBottom: 2,
                }}
              >
                New {KIND_LABEL[node.type ?? ""] ?? "Node"} node
              </div>
              {data.prompt && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(15,18,30,0.5)",
                    lineHeight: 1.4,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, color: "rgba(15,18,30,0.4)" }}
                  >
                    Prompt:{" "}
                  </span>
                  {formatValue(data.prompt)}
                </div>
              )}
              {data.output && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(15,18,30,0.5)",
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, color: "rgba(15,18,30,0.4)" }}
                  >
                    Output:{" "}
                  </span>
                  {formatValue(data.output)}
                </div>
              )}
              {data.model && (
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(15,18,30,0.35)",
                    marginTop: 2,
                  }}
                >
                  {formatValue(data.model)}
                </div>
              )}
            </DiffCard>
          );
        })}

        {/* Removed nodes */}
        {diff.nodes.removed.map((id) => {
          const node = beforeMap.get(id);
          if (!node) return null;
          const data = node.data as unknown as GenerativeNodeData;
          const c = DIFF_COLOR.removed;
          return (
            <DiffCard
              key={`rm-${id}`}
              accent={c.accent}
              bg={c.bg}
              border={c.border}
            >
              <DiffBadge color={c.accent}>Removed</DiffBadge>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f121e",
                  marginBottom: 2,
                }}
              >
                {KIND_LABEL[node.type ?? ""] ?? "Node"} node removed
              </div>
              {data.prompt && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(15,18,30,0.5)",
                    lineHeight: 1.4,
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, color: "rgba(15,18,30,0.4)" }}
                  >
                    Prompt:{" "}
                  </span>
                  {formatValue(data.prompt)}
                </div>
              )}
              {data.output && (
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(15,18,30,0.5)",
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{ fontWeight: 600, color: "rgba(15,18,30,0.4)" }}
                  >
                    Output:{" "}
                  </span>
                  {formatValue(data.output)}
                </div>
              )}
              {data.model && (
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(15,18,30,0.35)",
                    marginTop: 2,
                  }}
                >
                  {formatValue(data.model)}
                </div>
              )}
            </DiffCard>
          );
        })}

        {/* Changed nodes */}
        {diff.nodes.changed.map((ch: ChangedNode) => {
          const c = DIFF_COLOR.changed;
          const visibleFields = filterFields(ch.changedFields);
          if (visibleFields.length === 0) return null;
          return (
            <DiffCard
              key={`ch-${ch.id}`}
              accent={c.accent}
              bg={c.bg}
              border={c.border}
            >
              <DiffBadge color={c.accent}>Changed</DiffBadge>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#0f121e",
                  marginBottom: 6,
                }}
              >
                {KIND_LABEL[ch.after.type ?? ""] ?? "Node"} ·{" "}
                {visibleFields.map((f) => fieldLabel(f)).join(", ")}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "70px 1fr 1fr",
                  rowGap: 4,
                  columnGap: 6,
                  fontSize: 10,
                }}
              >
                <div
                  style={{ fontWeight: 700, color: "rgba(15,18,30,0.4)" }}
                ></div>
                <div style={{ fontWeight: 700, color: "#E5484D" }}>Before</div>
                <div style={{ fontWeight: 700, color: "#39B27A" }}>After</div>
                {visibleFields.map((f) => (
                  <FieldRow
                    key={f}
                    field={f}
                    before={readField(ch.before, f)}
                    after={readField(ch.after, f)}
                  />
                ))}
              </div>
            </DiffCard>
          );
        })}

        {/* Edge changes */}
        {(diff.edges.added.length > 0 || diff.edges.removed.length > 0) && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(15,18,30,0.03)",
              border: "1px solid rgba(15,18,30,0.06)",
              fontSize: 11,
              color: "rgba(15,18,30,0.5)",
            }}
          >
            Edges:{" "}
            {diff.edges.added.length > 0 && (
              <span style={{ color: "#39B27A" }}>
                +{diff.edges.added.length}
              </span>
            )}
            {diff.edges.added.length > 0 &&
              diff.edges.removed.length > 0 &&
              " / "}
            {diff.edges.removed.length > 0 && (
              <span style={{ color: "#E5484D" }}>
                -{diff.edges.removed.length}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffCard({
  children,
  accent,
  bg,
  border,
}: {
  children: React.ReactNode;
  accent: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function DiffBadge({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        color: "#fff",
        background: color,
        borderRadius: 999,
        padding: "1px 7px",
        marginBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

function FieldRow({
  field,
  before,
  after,
}: {
  field: string;
  before: unknown;
  after: unknown;
}) {
  return (
    <>
      <div
        style={{ color: "rgba(15,18,30,0.55)", fontWeight: 600, fontSize: 10 }}
      >
        {fieldLabel(field)}
      </div>
      <div style={{ color: "rgba(15,18,30,0.6)", wordBreak: "break-word" }}>
        {formatValue(before)}
      </div>
      <div style={{ color: "rgba(15,18,30,0.6)", wordBreak: "break-word" }}>
        {formatValue(after)}
      </div>
    </>
  );
}

function RestoreButton({
  lineageId,
  onRestore,
}: {
  lineageId: string;
  onRestore: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (confirming) {
          onRestore(lineageId);
          setConfirming(false);
        } else {
          setConfirming(true);
        }
      }}
      onBlur={() => setConfirming(false)}
      style={{
        width: "100%",
        padding: "6px 0",
        fontSize: 10,
        fontWeight: 700,
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        background: confirming ? "#6366F1" : "rgba(99,102,241,0.10)",
        color: confirming ? "#fff" : "#6366F1",
        transition: "background 150ms, color 150ms",
      }}
    >
      {confirming ? "Confirm Restore" : "Restore This Version"}
    </button>
  );
}

export function AncestryPanel({ projectId }: { projectId: string }) {
  const ancestryNodeId = useWorkflowStore((s) => s.ancestryNodeId);
  const setAncestryNodeId = useWorkflowStore((s) => s.setAncestryNodeId);
  const compareSelection = useWorkflowStore((s) => s.compareSelection);
  const compareBefore = useWorkflowStore((s) => s.compareBefore);
  const compareAfter = useWorkflowStore((s) => s.compareAfter);
  const compareDiff = useWorkflowStore((s) => s.compareDiff);
  const compareBeforeId = useWorkflowStore((s) => s.compareBeforeId);
  const compareAfterId = useWorkflowStore((s) => s.compareAfterId);
  const compareViewSide = useWorkflowStore((s) => s.compareViewSide);
  const toggleCompareSelection = useWorkflowStore(
    (s) => s.toggleCompareSelection,
  );
  const enterCompareMode = useWorkflowStore((s) => s.enterCompareMode);
  const exitCompareMode = useWorkflowStore((s) => s.exitCompareMode);
  const setCompareViewSide = useWorkflowStore((s) => s.setCompareViewSide);

  const [lineages, setLineages] = useState<LineageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  const users = useWorkflowStore((s) => s.users);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const isOpen = ancestryNodeId !== null;

  const handleRestore = useCallback((lineageId: string) => {
    getSocket().emit("lineage:restore" as any, { lineageId });
  }, []);

  useEffect(() => {
    if (!ancestryNodeId) {
      setLineages([]);
      return;
    }
    setLoading(true);
    fetchLineages(projectId, ancestryNodeId).then((records) => {
      setLineages([...records].reverse());
      setLoading(false);
    });
  }, [projectId, ancestryNodeId]);

  const handleCompareClick = useCallback(
    (record: LineageRecord) => {
      const already = compareSelection.includes(record.id);
      toggleCompareSelection(record.id);
      const next = already
        ? compareSelection.filter((id) => id !== record.id)
        : [...compareSelection, record.id].slice(-2);

      if (next.length === 2) {
        setCompareLoading(true);
        const a = lineages.find((l) => l.id === next[0]);
        const b = lineages.find((l) => l.id === next[1]);
        if (a && b) {
          const [beforeRec, afterRec] =
            a.capturedAt <= b.capturedAt ? [a, b] : [b, a];
          enterCompareMode(
            beforeRec.workflowSubgraph,
            afterRec.workflowSubgraph,
            diffGraphs(beforeRec.workflowSubgraph, afterRec.workflowSubgraph),
            beforeRec.id,
            afterRec.id,
          );
        }
        setCompareLoading(false);
      } else {
        if (compareDiff) exitCompareMode();
      }
    },
    [
      compareSelection,
      lineages,
      toggleCompareSelection,
      enterCompareMode,
      exitCompareMode,
      compareDiff,
    ],
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        height: "100vh",
        width: 400,
        background: "#fff",
        borderLeft: "1px solid rgba(15,18,30,0.08)",
        boxShadow: "-8px 0 32px rgba(15,18,30,0.08)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 240ms cubic-bezier(0.4, 0, 0.2, 1)",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        pointerEvents: isOpen ? "auto" : "none",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 18px 14px",
          borderBottom: "1px solid rgba(15,18,30,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f121e" }}>
            Provenance
          </div>
          {lineages.length > 0 && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(15,18,30,0.45)",
                marginTop: 2,
              }}
            >
              {lineages.length} generation{lineages.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAncestryNodeId(null)}
          style={{
            background: "rgba(15,18,30,0.06)",
            border: "none",
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: "pointer",
            fontSize: 14,
            color: "rgba(15,18,30,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          x
        </button>
      </div>

      {compareDiff ? (
        <CompareDetails
          diff={compareDiff}
          before={compareBefore}
          after={compareAfter}
          onExit={exitCompareMode}
          beforeLineageId={compareBeforeId}
          afterLineageId={compareAfterId}
          beforeMeta={(() => {
            const r = lineages.find((l) => l.id === compareBeforeId);
            return r
              ? { generatedBy: r.generatedBy, capturedAt: r.capturedAt }
              : null;
          })()}
          afterMeta={(() => {
            const r = lineages.find((l) => l.id === compareAfterId);
            return r
              ? { generatedBy: r.generatedBy, capturedAt: r.capturedAt }
              : null;
          })()}
          viewSide={compareViewSide}
          onToggle={setCompareViewSide}
          onRestore={handleRestore}
        />
      ) : (
        <>
          {/* Section label */}
          <div
            style={{
              padding: "12px 18px 6px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: "rgba(15,18,30,0.35)",
              flexShrink: 0,
            }}
          >
            Generation Lineage
          </div>

          {/* Lineage list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "0 12px 12px" }}>
            {loading && (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  fontSize: 12,
                  color: "rgba(15,18,30,0.4)",
                }}
              >
                Loading…
              </div>
            )}

            {!loading && lineages.length === 0 && (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  fontSize: 12,
                  color: "rgba(15,18,30,0.4)",
                }}
              >
                No generations recorded yet.
                <br />
                Connect an AI model and click Generate.
              </div>
            )}

            {lineages.map((record, idx) => {
              const isExpanded = expandedId === record.id;
              const outputText = getOutputText(record);
              const compareIdx = compareSelection.indexOf(record.id);
              const isSelected = compareIdx !== -1;

              return (
                <div
                  key={record.id}
                  style={{
                    background: "#fafbff",
                    border: isSelected
                      ? "1.5px solid rgba(99,102,241,0.4)"
                      : "1px solid rgba(15,18,30,0.07)",
                    borderRadius: 14,
                    marginBottom: 8,
                    overflow: "hidden",
                  }}
                >
                  {/* Row header */}
                  <div
                    style={{
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: record.error ? "#EF4444" : "#3F3FE0",
                          color: "#fff",
                          fontSize: 9,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {lineages.length - idx}
                      </div>
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(15,18,30,0.7)",
                              fontWeight: 500,
                            }}
                          >
                            {formatTime(record.capturedAt)}
                          </span>
                          {(() => {
                            const author = userMap.get(record.generatedBy);
                            return (
                              <div
                                title={
                                  author?.name ?? record.generatedBy.slice(0, 6)
                                }
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 999,
                                  background: author?.color ?? "#999",
                                  color: "#fff",
                                  fontSize: 7,
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                {(author?.name ?? "?")
                                  .slice(0, 1)
                                  .toUpperCase()}
                              </div>
                            );
                          })()}
                        </div>
                        <div
                          style={{ fontSize: 10, color: "rgba(15,18,30,0.4)" }}
                        >
                          {record.model.provider}/{record.model.model}
                          {" · "}
                          {record.workflowSubgraph.nodes.length} nodes
                        </div>
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "center" }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompareClick(record);
                        }}
                        disabled={compareLoading}
                        style={{
                          background: isSelected
                            ? "#6366F1"
                            : "rgba(99,102,241,0.10)",
                          color: isSelected ? "#fff" : "#6366F1",
                          border: "none",
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: compareLoading ? "wait" : "pointer",
                          transition: "background 200ms, color 200ms",
                        }}
                      >
                        {isSelected ? `Compare ${compareIdx + 1}/2` : "Compare"}
                      </button>
                      <span
                        style={{
                          fontSize: 12,
                          color: "rgba(15,18,30,0.3)",
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0)",
                          transition: "transform 200ms",
                          display: "inline-block",
                        }}
                      >
                        ▾
                      </span>
                    </div>
                  </div>

                  {/* Expanded: subgraph + output */}
                  {isExpanded && (
                    <div style={{ borderTop: "1px solid rgba(15,18,30,0.06)" }}>
                      {/* Upstream subgraph mini view */}
                      <div style={{ height: 180, margin: "8px 10px" }}>
                        <SubgraphMini subgraph={record.workflowSubgraph} />
                      </div>

                      {/* Generation output */}
                      {outputText && (
                        <div
                          style={{
                            margin: "0 14px 10px",
                            padding: 10,
                            borderRadius: 10,
                            background: "rgba(57,178,122,0.06)",
                            border: "1px solid rgba(57,178,122,0.15)",
                            fontSize: 11,
                            color: "rgba(15,18,30,0.7)",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            maxHeight: 120,
                            overflowY: "auto",
                          }}
                        >
                          {outputText}
                        </div>
                      )}

                      {record.error && (
                        <div
                          style={{
                            margin: "0 14px 10px",
                            padding: 10,
                            borderRadius: 10,
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.15)",
                            fontSize: 11,
                            color: "#B91C1C",
                          }}
                        >
                          {record.error}
                        </div>
                      )}

                      {/* Input details */}
                      <div
                        style={{
                          margin: "0 14px 8px",
                          fontSize: 10,
                          color: "rgba(15,18,30,0.45)",
                          lineHeight: 1.5,
                        }}
                      >
                        <div>
                          <strong>Prompt:</strong>{" "}
                          {record.generationInput.prompt}
                        </div>
                        {record.generationInput.system && (
                          <div>
                            <strong>System:</strong>{" "}
                            {record.generationInput.system}
                          </div>
                        )}
                        {record.generationOutput?.usage && (
                          <div>
                            Tokens: {record.generationOutput.usage.inputTokens}{" "}
                            in / {record.generationOutput.usage.outputTokens}{" "}
                            out
                          </div>
                        )}
                      </div>

                      {/* Restore button */}
                      <div style={{ margin: "0 14px 12px" }}>
                        <RestoreButton
                          lineageId={record.id}
                          onRestore={handleRestore}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
