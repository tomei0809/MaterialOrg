import type { FolderColor } from '@/types/material';

// フォルダの色の名前（色の値は app/globals.css の --fc-*、使い方は lib/folderColors.ts）
export const folderColorLabels: Record<FolderColor, string> = {
  blue: '藍',
  green: '若竹',
  yellow: '山吹',
  red: '紅',
  purple: '藤',
  teal: '浅葱',
  orange: '柿',
  olive: '鶯',
  pink: '桜鼠',
  gray: '鈍色',
};
