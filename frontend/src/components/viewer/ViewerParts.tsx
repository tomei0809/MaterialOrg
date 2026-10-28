'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// ビューア上部の帯の中央（形式ごとの操作を置く場所）
export const ToolbarSlotContext = createContext<HTMLElement | null>(null);

// 形式ごとの操作（拡大率・ページ送りなど）を上部の帯へ出す
export function ViewerToolbar({ children }: { children: ReactNode }) {
  const slot = useContext(ToolbarSlotContext);
  return slot ? createPortal(children, slot) : null;
}

export const toolButton =
  'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded px-2 text-xs text-foreground hover:bg-surface-muted disabled:opacity-40 aria-pressed:bg-foreground aria-pressed:text-surface';

export function ToolGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center rounded-md border border-border bg-surface">
      {children}
    </div>
  );
}

// 中央に出す案内（読み込み中・表示できないときなど）
export function ViewerMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">{children}</div>
  );
}

const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6, 8];
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
export const nextZoom = (value: number, dir: 1 | -1) =>
  dir > 0
    ? (ZOOM_STEPS.find((s) => s > value + 0.001) ?? MAX_ZOOM)
    : ([...ZOOM_STEPS].reverse().find((s) => s < value - 0.001) ?? MIN_ZOOM);

// 拡大率の操作（−・拡大率・＋・幅に合わせる・全体表示）
export function ZoomControls({
  zoom,
  onZoom,
  onFitWidth,
  onFitPage,
}: {
  zoom: number;
  onZoom: (value: number) => void;
  onFitWidth?: () => void;
  onFitPage?: () => void;
}) {
  return (
    <ToolGroup label="拡大率">
      <button type="button" className={toolButton} onClick={() => onZoom(nextZoom(zoom, -1))} aria-label="縮小" title="縮小（− キー）">
        −
      </button>
      <button
        type="button"
        className={`${toolButton} w-14 tabular-nums`}
        onClick={() => onZoom(1)}
        title="100% に戻す"
        aria-label={`拡大率 ${Math.round(zoom * 100)}%（クリックで 100%）`}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={toolButton} onClick={() => onZoom(nextZoom(zoom, 1))} aria-label="拡大" title="拡大（＋ キー）">
        ＋
      </button>
      {onFitWidth && (
        <button type="button" className={toolButton} onClick={onFitWidth} title="幅に合わせる">
          幅
        </button>
      )}
      {onFitPage && (
        <button type="button" className={toolButton} onClick={onFitPage} title="全体を表示（0 キー）">
          全体
        </button>
      )}
    </ToolGroup>
  );
}

// 入力欄で文字を打っているときは、ビューアのキー操作を効かせない
export function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  return Boolean(target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));
}
