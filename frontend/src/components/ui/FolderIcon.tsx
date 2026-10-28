import { folderColor } from '@/lib/folderColors';
import type { FolderColor } from '@/types/material';

type Props = {
  // null は未分類（灰色）
  color: FolderColor | null;
  open?: boolean;
  className?: string;
};

// フォルダの形のアイコン（開いているときは開いた形）。色はフォルダの色
export function FolderIcon({ color, open = false, className = 'size-7' }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ color: folderColor(color) }}
      fill="currentColor"
    >
      {open ? (
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6a2 2 0 0 1 1.4.6L12 6h6.5A2.5 2.5 0 0 1 21 8.5V9H7.2a2 2 0 0 0-1.9 1.4L3 17.5zM6.2 11h15.3a1 1 0 0 1 1 1.3l-2 6.3a2 2 0 0 1-1.9 1.4H4.4a1 1 0 0 1-1-1.3l1.9-6.3A2 2 0 0 1 6.2 11" />
      ) : (
        <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6a2 2 0 0 1 1.4.6L12 6h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      )}
    </svg>
  );
}
