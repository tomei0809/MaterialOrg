'use client';

import { useEffect, type ReactNode } from 'react';

type Props = {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

// 右からスライドして表示するパネル（Esc キー・背景クリックで閉じる）
export function Drawer({ title, onClose, children }: Props) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-2xl [animation:drawer-in_160ms_ease-out]"
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="min-w-0 text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-md px-2 py-1 text-xl leading-none text-muted hover:bg-surface-muted"
          >
            ×
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </aside>
    </div>
  );
}
