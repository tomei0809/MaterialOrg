import type { FolderColor } from '@/types/material';
import { FolderIcon } from './FolderIcon';

// 文字の横に置く小さなフォルダ（色はフォルダの色。null は未分類）
export function FolderDot({ color }: { color: FolderColor | null }) {
  return <FolderIcon color={color} className="size-3.5" />;
}
