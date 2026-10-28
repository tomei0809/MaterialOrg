import type { ReactNode } from 'react';
import { typeLabels, type MaterialType } from '@/types/material';

// 種類ごとの形（色はフォルダ専用なので、種類は墨一色の形だけで区別する）
const glyphs: Record<MaterialType, ReactNode> = {
  // 講義スライド：スクリーン
  slide: (
    <>
      <rect x="2" y="2.5" width="12" height="8.5" rx="1" />
      <path d="M8 11v2.5M5 13.5h6M4.5 8l2.2-2.2 1.6 1.4L11.5 4.5" />
    </>
  ),
  // 課題：鉛筆
  assignment: (
    <>
      <path d="M3 13l.8-3.2L10.6 3a1.3 1.3 0 0 1 1.8 0l.6.6a1.3 1.3 0 0 1 0 1.8L6.2 12.2z" />
      <path d="M9.5 4.1l2.4 2.4M3 13h10" />
    </>
  ),
  // 過去問：丸付けした答案
  past_exam: (
    <>
      <path d="M4 1.8h6l2.5 2.5v9.9H4z" />
      <path d="M9.8 1.8v2.7h2.7" />
      <circle cx="7.6" cy="9.4" r="2.4" />
    </>
  ),
  // ノート：綴じたノート
  notes: (
    <>
      <rect x="4" y="1.8" width="9" height="12.4" rx="1" />
      <path d="M2.5 4.5h3M2.5 8h3M2.5 11.5h3M7.5 5.5h3.5M7.5 8h3.5" />
    </>
  ),
  // その他：クリップ
  other: (
    <path d="M10.5 5.5 6.3 9.7a1.4 1.4 0 0 0 2 2l4.6-4.6a2.8 2.8 0 0 0-4-4L4.2 7.8a4.2 4.2 0 0 0 6 6l3.3-3.3" />
  ),
};

type Props = {
  type: MaterialType;
  // tile: 一覧の行などで使う枠付き、plain: 文字の横に置く小さい形
  variant?: 'tile' | 'plain';
  // plain の大きさ（Tailwind の size-*）
  size?: string;
  className?: string;
};

export function TypeIcon({ type, variant = 'tile', size = 'size-3.5', className = '' }: Props) {
  const svg = (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={variant === 'tile' ? 'size-4' : `${size} shrink-0 ${className}`}
    >
      {glyphs[type]}
    </svg>
  );

  if (variant === 'plain') return svg;

  return (
    <span
      title={typeLabels[type]}
      aria-label={typeLabels[type]}
      role="img"
      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground ${className}`}
    >
      {svg}
    </span>
  );
}
