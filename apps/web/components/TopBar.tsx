"use client";

import { useEffect, useRef, useState } from "react";
import {
  BoardsIcon,
  BookIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  FeedbackIcon,
  HelpIcon,
  HomeIcon,
  PasteIcon,
  RedoIcon,
  ShareIcon,
  ShortcutIcon,
  SparkleIcon,
  TrashIcon,
  UndoIcon,
  XLogoIcon,
} from "./icons";

export function TopBar({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(name), [name]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim() || "Template";
    if (trimmed !== name) onRename(trimmed);
  }

  return (
    <>
      <div
        ref={wrapRef}
        style={{ position: "absolute", top: 18, left: 18, zIndex: 30 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(232, 234, 240, 0.9)",
            borderRadius: 999,
            padding: 1,
            gap: 4,
            boxShadow: "0 1px 2px rgba(15,18,30,0.04)",
          }}
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: open ? "#fff" : "transparent",
              border: "none",
              borderRadius: 999,
              padding: "8px 12px",
              cursor: "pointer",
              color: "#0f121e",
            }}
            title="Menu"
          >
            <XLogoIcon width={20} height={20} />
            <ChevronDownIcon width={14} height={14} />
          </button>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") {
                  setDraft(name);
                  setEditing(false);
                }
              }}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                padding: "8px 14px 8px 6px",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                color: "#0f121e",
                width: Math.max(80, draft.length * 8 + 24),
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{
                background: "transparent",
                border: "none",
                padding: "8px 14px 8px 6px",
                fontSize: 13,
                fontWeight: 500,
                color: "#0f121e",
                cursor: "text",
                fontFamily: "inherit",
              }}
              title="Rename board"
            >
              {name}
            </button>
          )}
        </div>
        {open && <ProjectMenu onClose={() => setOpen(false)} />}
      </div>
      <div style={{ position: "absolute", top: 22, right: 22, zIndex: 30 }}>
        <button
          type="button"
          title="Provenance Assistant"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "#fff",
            border: "1px solid rgba(15,18,30,0.08)",
            boxShadow: "0 6px 18px rgba(15, 18, 30, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#0f121e",
          }}
        >
          <SparkleIcon width={22} height={22} />
        </button>
      </div>
    </>
  );
}

function ProjectMenu({ onClose }: { onClose: () => void }) {
  const Item = ({
    icon,
    label,
    danger,
    disabled,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        onClick?.();
        onClose();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        fontSize: 14,
        fontFamily: "inherit",
        color: disabled ? "rgba(15,18,30,0.3)" : danger ? "#E04E3F" : "#0f121e",
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(15,18,30,0.05)";
      }}
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLButtonElement).style.background =
          "transparent")
      }
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {children}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        width: 280,
        background: "#fff",
        border: "1px solid rgba(15,18,30,0.08)",
        borderRadius: 14,
        boxShadow: "0 12px 32px rgba(15, 18, 30, 0.10)",
        padding: 8,
        fontFamily: "inherit",
      }}
    >
      <Row>
        <Item icon={<HomeIcon width={18} height={18} />} label="Home" />
        <Item icon={<BoardsIcon width={18} height={18} />} label="Boards" />
      </Row>
      <Item icon={<ShareIcon width={18} height={18} />} label="Share Board" />
      <Item icon={<DownloadIcon width={18} height={18} />} label="Backups" />
      <Item icon={<ShortcutIcon width={18} height={18} />} label="Shortcut" />
      <Row>
        <Item icon={<CopyIcon width={18} height={18} />} label="Copy" />
        <Item icon={<PasteIcon width={18} height={18} />} label="Paste" />
      </Row>
      <Row>
        <Item
          icon={<UndoIcon width={18} height={18} />}
          label="Undo"
          disabled
        />
        <Item
          icon={<RedoIcon width={18} height={18} />}
          label="Redo"
          disabled
        />
      </Row>
      <Item icon={<TrashIcon width={18} height={18} />} label="Delete" danger />
      <Item
        icon={<FeedbackIcon width={18} height={18} />}
        label="Send Feedback"
      />
      <Item icon={<BookIcon width={18} height={18} />} label="Documentation" />
      <Item icon={<HelpIcon width={18} height={18} />} label="Show Tooltips" />
    </div>
  );
}
