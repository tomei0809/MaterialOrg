// フォルダの色（色はフォルダだけに使う。種類は墨一色のアイコンの形で表す）
// 色そのものは app/globals.css の --fc-*（ライト／ダークで明度が変わる）

import type { Folder, FolderColor } from '@/types/material';

// style 属性で使う CSS の色。未分類（フォルダなし）は補助文字色
export function folderColor(color: FolderColor | null | undefined) {
  return color ? `var(--fc-${color})` : 'var(--muted)';
}

// 薄い地の色（現在地の強調・区切り見出しなど）
export function folderTint(color: FolderColor | null | undefined, percent = 12) {
  return `color-mix(in srgb, ${folderColor(color)} ${percent}%, var(--surface))`;
}

// 教材の所属フォルダの色（未分類・不明なフォルダは補助文字色）
export function materialFolderColor(folderId: number | null, folders: Map<number, Folder>) {
  return folderColor(folderId !== null ? folders.get(folderId)?.color : null);
}
