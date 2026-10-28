'use client';

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { folderColor } from '@/lib/folderColors';
import { formatFileSize } from '@/lib/format';
import type { Folder, Material } from '@/types/material';
import { ViewerBody } from './ViewerBody';
import { isTyping, ToolbarSlotContext, toolButton } from './ViewerParts';

type Props = {
  material: Material;
  folders: Map<number, Folder>;
  // 一覧の中での位置（前後の教材へ移るため）
  position: { index: number; total: number };
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
};

// 添付ファイルを画面全体で開くビューア（ページを離れずに読む）
export default function FileViewer({ material, folders, position, onPrev, onNext, onClose }: Props) {
  const dialog = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const url = material.file_url ?? '';
  const name = material.file_name ?? material.title;
  const color = folderColor(material.folder_id !== null ? folders.get(material.folder_id)?.color : null);

  // 開いたときに閉じるボタンへフォーカスし、閉じたら元の場所へ戻す
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => before?.focus?.();
  }, []);

  // Esc で閉じる。Shift+←→（ページのない形式では ←→ だけでも）で前後の教材へ。
  // 中の表示（PDF のページ送りや検索欄など）が同じキーを使ったときは何もしない。
  // 登録の順番に関係なく判定できるよう、すべての処理が終わってから見る
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== 'Escape' && (isTyping(event) || !['ArrowLeft', 'ArrowRight'].includes(event.key))) return;
      window.setTimeout(() => {
        if (event.defaultPrevented) return;
        if (event.key === 'Escape') onClose();
        else if (event.key === 'ArrowRight') onNext?.();
        else if (event.key === 'ArrowLeft') onPrev?.();
      }, 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNext, onPrev]);

  // Tab でフォーカスがビューアの外へ出ないようにする
  const trapFocus = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const items = [...dialog.current.querySelectorAll<HTMLElement>('button, a[href], input, select, video, audio, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`${material.title} を表示`}
      onKeyDown={trapFocus}
      className="fixed inset-0 z-[85] flex flex-col bg-surface"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-3 py-2" style={{ boxShadow: `inset 0 3px 0 ${color}` }}>
        <button type="button" onClick={onClose} className={`${toolButton} text-base`} aria-label="ビューアを閉じる" title="閉じる（Esc）">
          ✕
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <TypeIcon type={material.material_type} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{material.title}</p>
            <p className="truncate text-[11px] text-muted">
              {name}
              {material.file_size ? `　${formatFileSize(material.file_size)}` : ''}
            </p>
          </div>
        </div>

        {/* 形式ごとの操作（拡大率・ページ送りなど）はここに入る */}
        <div ref={setSlot} className="flex flex-1 flex-wrap items-center justify-center gap-2" />

        <div className="ml-auto flex items-center gap-1">
          <div role="group" aria-label="前後の教材" className="flex items-center">
            <button type="button" className={toolButton} onClick={onPrev ?? undefined} disabled={!onPrev} aria-label="前の教材" title="前の教材（Shift+←）">
              ‹ 前
            </button>
            <span className="px-1 text-xs text-muted tabular-nums">
              {position.index + 1}/{position.total}
            </span>
            <button type="button" className={toolButton} onClick={onNext ?? undefined} disabled={!onNext} aria-label="次の教材" title="次の教材（Shift+→）">
              次 ›
            </button>
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className={toolButton} title="ブラウザの新しいタブで開く">
            新しいタブ ↗
          </a>
          <a href={url} download={name} className={toolButton} title="ファイルを保存">
            保存 ⬇
          </a>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <ToolbarSlotContext.Provider value={slot}>
          {url ? <ViewerBody key={material.id} source={{ url, name, size: material.file_size ?? 0 }} /> : null}
        </ToolbarSlotContext.Provider>
      </main>
    </div>
  );
}
