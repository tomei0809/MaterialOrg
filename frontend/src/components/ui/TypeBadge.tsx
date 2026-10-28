import { typeLabels, type MaterialType } from '@/types/material';
import { TypeIcon } from './TypeIcon';

// 種類の表示（色はフォルダ専用なので、墨一色のアイコン＋名前）
export function TypeBadge({ type }: { type: MaterialType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs font-bold">
      <TypeIcon type={type} variant="plain" />
      {typeLabels[type]}
    </span>
  );
}
