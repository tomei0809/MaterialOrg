// 一覧の2列・3列表示：行の並びを上から順に列へ分ける（新聞の段組みと同じく、1列目の下の続きが2列目の上）

import type { TableRow } from './folderTree';

export const LIST_COLUMN_OPTIONS = [1, 2, 3] as const;
export type ListColumns = (typeof LIST_COLUMN_OPTIONS)[number];

// その下に中身が続く見出しの行（列の最後に見出しだけが残らないようにする）
const isHeading = (row: TableRow) =>
  row.kind === 'group' ||
  (row.kind === 'folder' && row.expanded) ||
  (row.kind === 'bundle' && row.expanded);

export function splitRows(rows: TableRow[], columns: number): TableRow[][] {
  if (columns <= 1 || rows.length <= 1) return [rows];
  const result: TableRow[][] = [];
  let start = 0;
  for (let col = 0; col < columns - 1 && start < rows.length; col++) {
    // 残りの行を残りの列数で均等に分ける
    const size = Math.ceil((rows.length - start) / (columns - col));
    let end = Math.min(rows.length, start + size);
    // 区切り位置の直前が見出しなら、見出しごと次の列へ送る
    while (end - 1 > start && end < rows.length && isHeading(rows[end - 1])) end--;
    result.push(rows.slice(start, end));
    start = end;
  }
  if (start < rows.length) result.push(rows.slice(start));
  return result;
}
