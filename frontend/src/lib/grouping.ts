// 一覧を「フォルダ／種類」ごとに区切って並べる

import {
  MATERIAL_TYPES,
  typeLabels,
  type Bundle,
  type Folder,
  type GroupBy,
  type Material,
  type MaterialType,
  type SortOrder,
} from '@/types/material';
import { groupIntoBundles, type GroupedRow } from './bundles';
import { flattenFolders, folderPath, type FolderIndex } from './folderTree';
import { countByType, sortMaterials } from './materialView';

export const groupByLabels: Record<GroupBy, string> = {
  folder: 'フォルダごと',
  type: '種類ごと',
  none: '区切らない',
};

// 区切りの見出し行
export type GroupRow = {
  kind: 'group';
  // 開閉状態を覚えるためのキー（例：folder:12、type:slide）
  key: string;
  label: string;
  // 見出しの手がかり（フォルダなら色、種類ならアイコン）。folder が null なら未分類
  type?: MaterialType;
  folder?: Folder | null;
  count: number;
  breakdown: Record<MaterialType, number>;
  collapsed: boolean;
  // 見出しのチェックでまとめて選択するための教材ID（閉じていても含む）
  ids: number[];
};

type Options = {
  materials: Material[];
  groupBy: GroupBy;
  sortOrder: SortOrder;
  bundles: Map<number, Bundle>;
  expandedBundles: Set<number>;
  collapsedGroups: Set<string>;
  folderIndex: FolderIndex;
};

type Group = Omit<GroupRow, 'kind' | 'count' | 'breakdown' | 'collapsed' | 'ids'> & {
  items: Material[];
};

function makeGroups(materials: Material[], groupBy: GroupBy, folderIndex: FolderIndex): Group[] {
  if (groupBy === 'type') {
    return MATERIAL_TYPES.map((type) => ({
      key: `type:${type}`,
      label: typeLabels[type],
      type,
      items: materials.filter((m) => m.material_type === type),
    })).filter((g) => g.items.length > 0);
  }

  // フォルダ：ツリーの並び順で、見出しは「親 › 子」の道筋。未分類は最後
  const groups: Group[] = flattenFolders(folderIndex).map(({ folder }) => ({
    key: `folder:${folder.id}`,
    label: folderPath(folderIndex, folder.id).map((f) => f.name).join(' › '),
    folder,
    items: materials.filter((m) => m.folder_id === folder.id),
  }));
  groups.push({
    key: 'folder:none',
    label: '未分類',
    folder: null,
    items: materials.filter((m) => m.folder_id === null || !folderIndex.byId.has(m.folder_id)),
  });
  return groups.filter((g) => g.items.length > 0);
}

export function buildGroupedRows({
  materials,
  groupBy,
  sortOrder,
  bundles,
  expandedBundles,
  collapsedGroups,
  folderIndex,
}: Options): (GroupRow | GroupedRow)[] {
  if (groupBy === 'none') {
    return groupIntoBundles(sortMaterials(materials, sortOrder), bundles, expandedBundles, 0);
  }

  const rows: (GroupRow | GroupedRow)[] = [];
  for (const { items, ...group } of makeGroups(materials, groupBy, folderIndex)) {
    const collapsed = collapsedGroups.has(group.key);
    rows.push({
      kind: 'group',
      ...group,
      count: items.length,
      breakdown: countByType(items),
      collapsed,
      ids: items.map((m) => m.id),
    });
    if (!collapsed) {
      rows.push(...groupIntoBundles(sortMaterials(items, sortOrder), bundles, expandedBundles, 0));
    }
  }
  return rows;
}
