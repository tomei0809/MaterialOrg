'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useReducedMotion } from './hooks';

// 中央に出す短い案内（読み込み中・読めないときなど）
export function PreviewMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted">
      {children}
    </div>
  );
}

// スライドショーの位置（右下の「3 / 12」）
export function SlideCounter({ index, total, label }: { index: number; total: number; label?: string }) {
  return (
    <span className="absolute right-2 bottom-2 rounded-full bg-foreground/75 px-2 text-[11px] leading-5 font-bold text-surface tabular-nums">
      {label ? `${label} ` : ''}
      {index + 1} / {total}
    </span>
  );
}

// 中身を少し止めてから下へゆっくり流し、最後まで行ったら先頭に戻る
export function AutoScroll({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const SPEED = 28; // px/秒
    const PAUSE = 800; // 先頭と末尾で止まる時間（ms）
    let frame = 0;
    let last = 0;
    let waitUntil = performance.now() + PAUSE;
    let position = 0;

    const step = (now: number) => {
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0 && now >= waitUntil) {
        position += (SPEED * (now - (last || now))) / 1000;
        if (position >= max) {
          el.scrollTop = max;
          // 末尾で止まってから先頭に戻る
          position = 0;
          waitUntil = now + PAUSE * 2;
          window.setTimeout(() => {
            if (ref.current) ref.current.scrollTop = 0;
          }, PAUSE * 1.5);
        } else {
          el.scrollTop = position;
        }
      }
      last = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  return (
    <div ref={ref} className={`h-full overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// 表（CSV・Excel の先頭部分）
export function PreviewTable({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return <PreviewMessage>表の中身がありません</PreviewMessage>;
  return (
    <div className="h-full overflow-hidden">
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className={r === 0 ? 'bg-surface-muted font-bold' : ''}>
              <td className="border border-border px-1 text-right text-muted tabular-nums">{r + 1}</td>
              {row.map((cell, c) => (
                <td key={c} className="max-w-28 truncate border border-border px-1.5 py-0.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
