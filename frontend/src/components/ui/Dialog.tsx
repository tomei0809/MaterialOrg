'use client';

import { useEffect, type ReactNode } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  // 一覧を含むダイアログ（一括登録など）は幅を広げる
  wide?: boolean;
};

// 画面中央の小さなダイアログ（Esc キー・背景クリックで閉じる）
export function Dialog({ title, onClose, children, wide = false }: Props) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full rounded-xl border border-border bg-surface p-5 shadow-2xl ${
          wide ? 'max-w-2xl' : 'max-w-sm'
        }`}
      >
        <h2 className="mb-4 text-base font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
