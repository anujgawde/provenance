'use client';

import { create } from 'zustand';
import { useEffect } from 'react';

interface ToastItem {
  id: string;
  message: string;
  type: 'error' | 'info';
  createdAt: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type?: 'error' | 'info') => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type = 'error') =>
    set((s) => ({
      toasts: [...s.toasts, { id: crypto.randomUUID(), message, type, createdAt: Date.now() }],
    })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bg = toast.type === 'error' ? '#dc2626' : '#4f46e5';

  return (
    <div
      style={{
        background: bg,
        color: '#fff',
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        maxWidth: 320,
      }}
      onClick={onDismiss}
    >
      {toast.message}
    </div>
  );
}
