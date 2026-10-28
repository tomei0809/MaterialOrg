// 一覧表示用の絞り込み・件数集計・並び替え（すべてブラウザ側で行う純粋関数）

import {
  MATERIAL_TYPES,
  type Material,
  type MaterialType,
  type Scope,
  type SortOrder,
  type ViewFilters,
} from '@/types/material';

const DAY = 24 * 60 * 60 * 1000;
// サイドバーの「最近追加」に含める日数と、NEW 表示の日数
export const RECENT_DAYS = 7;
export const NEW_DAYS = 3;

const time = (value: string) => new Date(value).getTime();
const openedTime = (m: Material) => (m.last_opened_at ? time(m.last_opened_at) : 0);

export function isWithinDays(value: string, days: number, now: number) {
  return now - time(value) <= days * DAY;
}

// 絞り込みに必要な外部の情報
export type ViewContext = {
  // 「最近追加」の判定基準
  now: number;
  // フォルダ表示のとき、そのフォルダと子孫フォルダの ID（lib/folderTree.ts の subtreeIds）
  scopeFolderIds?: Set<number>;
  // まとめの名前（まとめの名前で検索したとき、中の教材をすべてヒットさせる）
  bundleNames?: Map<number, string>;
  // フォルダの道筋（例：2026 前期 › 情報数学）。フォルダ名でも検索できるようにする
  folderPaths?: Map<number, string>;
};

export function matchesScope(material: Material, scope: Scope, context: ViewContext) {
  switch (scope.kind) {
    case 'all':
      return true;
    case 'recent':
      return isWithinDays(material.created_at, RECENT_DAYS, context.now);
    case 'unfiled':
      return material.folder_id === null;
    case 'favorites':
      return Boolean(material.favorited_at);
    case 'opened':
      return Boolean(material.last_opened_at);
    case 'folder':
      // サブフォルダの中の教材も含める
      return (
        material.folder_id !== null &&
        (context.scopeFolderIds?.has(material.folder_id) ?? material.folder_id === scope.id)
      );
  }
}

// 教材名・フォルダ名・まとめ名・説明・タグ・ファイル名のどれかに含まれていればヒット
function matchesQuery(material: Material, query: string, context: ViewContext) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const haystack = [
    material.bundle_id !== null ? (context.bundleNames?.get(material.bundle_id) ?? '') : '',
    material.title,
    material.folder_id !== null ? (context.folderPaths?.get(material.folder_id) ?? '') : '',
    material.description ?? '',
    material.file_name ?? '',
    ...material.tags,
  ]
    .join('\n')
    .toLowerCase();

  // スペース区切りは AND 検索
  return words.every((word) => haystack.includes(word));
}

// ignoreType: 種類タブの件数を出すときは種類以外の条件だけで絞る
export function filterMaterials(
  materials: Material[],
  filters: ViewFilters,
  context: ViewContext,
  { ignoreType = false } = {},
) {
  return materials.filter(
    (material) =>
      matchesScope(material, filters.scope, context) &&
      (ignoreType || filters.type === 'all' || material.material_type === filters.type) &&
      (!filters.tag || material.tags.includes(filters.tag)) &&
      matchesQuery(material, filters.query, context),
  );
}

export function countByType(materials: Material[]) {
  const counts = Object.fromEntries(MATERIAL_TYPES.map((type) => [type, 0])) as Record<
    MaterialType,
    number
  >;
  for (const material of materials) counts[material.material_type] += 1;
  return counts;
}

// 値ごとの件数を多い順（同数なら名前順）で返す
export function countValues(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));
}

// 数字は数として比べる（「第2回」が「第10回」より前に来る）
const collator = new Intl.Collator('ja', { numeric: true });
export const byTitle = (a: Material, b: Material) => collator.compare(a.title, b.title);

// 並び順ごとの比較関数（同順位のときは教材名順にそろえる）
const comparators: Record<SortOrder, (a: Material, b: Material) => number> = {
  created_desc: (a, b) => time(b.created_at) - time(a.created_at),
  created_asc: (a, b) => time(a.created_at) - time(b.created_at),
  updated_desc: (a, b) => time(b.updated_at) - time(a.updated_at),
  updated_asc: (a, b) => time(a.updated_at) - time(b.updated_at),
  title_asc: byTitle,
  title_desc: (a, b) => byTitle(b, a),
  type_asc: (a, b) =>
    MATERIAL_TYPES.indexOf(a.material_type) -
      MATERIAL_TYPES.indexOf(b.material_type) || byTitle(a, b),
  tags_desc: (a, b) => b.tags.length - a.tags.length || byTitle(a, b),
  // 開いたことのないものは後ろへ
  opened_desc: (a, b) => openedTime(b) - openedTime(a) || byTitle(a, b),
  file_first: (a, b) =>
    Number(Boolean(b.file_attached)) - Number(Boolean(a.file_attached)) ||
    time(b.created_at) - time(a.created_at),
};

export function sortMaterials(materials: Material[], order: SortOrder) {
  return [...materials].sort(comparators[order]);
}
