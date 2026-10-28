// フォルダの階層構造を扱うユーティリティ（API は parent_id 付きのフラットな配列を返す）

import type { Bundle, Folder, Material, SortOrder } from '@/types/material';
import { groupIntoBundles, type GroupedRow } from './bundles';
import type { GroupRow } from './grouping';
import { sortMaterials } from './materialView';

// 並び順（ドラッグで並び替えたもの）→ 名前の順
const byPosition = (a: Folder, b: Folder) =>
  a.position - b.position || a.name.localeCompare(b.name, 'ja');

export type FolderIndex = {
  byId: Map<number, Folder>;
  // 親フォルダID（最上位は null）→ 子フォルダ（並び順）
  children: Map<number | null, Folder[]>;
};

export function buildFolderIndex(folders: Folder[]): FolderIndex {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const children = new Map<number | null, Folder[]>();

  for (const folder of folders) {
    // 親が見つからない（不整合な）フォルダは最上位として扱う
    const parentId =
      folder.parent_id !== null && byId.has(folder.parent_id) ? folder.parent_id : null;
    const list = children.get(parentId) ?? [];
    list.push(folder);
    children.set(parentId, list);
  }
  for (const list of children.values()) list.sort(byPosition);

  return { byId, children };
}

// 指定フォルダとその子孫すべての ID
export function subtreeIds(index: FolderIndex, id: number): Set<number> {
  const ids = new Set<number>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (ids.has(current)) continue;
    ids.add(current);
    for (const child of index.children.get(current) ?? []) stack.push(child.id);
  }
  return ids;
}

// 最上位から指定フォルダまでの道筋（パンくず用）
export function folderPath(index: FolderIndex, id: number): Folder[] {
  const path: Folder[] = [];
  let current = index.byId.get(id);
  while (current && path.length <= index.byId.size) {
    path.unshift(current);
    current = current.parent_id !== null ? index.byId.get(current.parent_id) : undefined;
  }
  return path;
}

// 最上位を 1 とした深さ
export function folderDepth(index: FolderIndex, id: number) {
  return folderPath(index, id).length;
}

// セレクトボックス用に、木を深さ付きで上から順に並べる
export function flattenFolders(
  index: FolderIndex,
  { exclude }: { exclude?: Set<number> } = {},
): { folder: Folder; depth: number }[] {
  const result: { folder: Folder; depth: number }[] = [];

  const walk = (parentId: number | null, depth: number) => {
    for (const folder of index.children.get(parentId) ?? []) {
      if (exclude?.has(folder.id)) continue;
      result.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);

  return result;
}

// セレクトボックスの表示名（階層を全角スペースで字下げ）
export function indentedName(name: string, depth: number) {
  return `${'　'.repeat(depth)}${depth > 0 ? '└ ' : ''}${name}`;
}

// --- フォルダを開いたときの一覧（トグルリスト）---

export type TableRow =
  | { kind: 'folder'; folder: Folder; depth: number; count: number; expanded: boolean }
  | GroupRow
  | GroupedRow;

type BuildRowsOptions = {
  rootId: number;
  index: FolderIndex;
  // 絞り込み済み（フォルダ範囲・種類・検索など）の教材
  materials: Material[];
  sortOrder: SortOrder;
  expanded: Set<number>;
  // まとめ（同じまとめの教材は1行に束ねる）
  bundles: Map<number, Bundle>;
  expandedBundles: Set<number>;
  // 検索などで絞り込み中は、該当する教材がないサブフォルダを隠す
  hideEmptyFolders: boolean;
};

// 開いているフォルダ直下に、サブフォルダ（展開すると中身が見える）→ 教材 の順で並べる
export function buildFolderRows({
  rootId,
  index,
  materials,
  sortOrder,
  expanded,
  bundles,
  expandedBundles,
  hideEmptyFolders,
}: BuildRowsOptions): TableRow[] {
  const byFolder = new Map<number | null, Material[]>();
  for (const material of materials) {
    const list = byFolder.get(material.folder_id) ?? [];
    list.push(material);
    byFolder.set(material.folder_id, list);
  }

  const countCache = new Map<number, number>();
  const countSubtree = (id: number): number => {
    if (countCache.has(id)) return countCache.get(id)!;
    const count =
      (byFolder.get(id)?.length ?? 0) +
      (index.children.get(id) ?? []).reduce((sum, child) => sum + countSubtree(child.id), 0);
    countCache.set(id, count);
    return count;
  };

  const rows: TableRow[] = [];
  const walk = (folderId: number, depth: number) => {
    for (const child of index.children.get(folderId) ?? []) {
      const count = countSubtree(child.id);
      if (hideEmptyFolders && count === 0) continue;

      const isExpanded = expanded.has(child.id);
      rows.push({ kind: 'folder', folder: child, depth, count, expanded: isExpanded });
      if (isExpanded) walk(child.id, depth + 1);
    }
    rows.push(
      ...groupIntoBundles(
        sortMaterials(byFolder.get(folderId) ?? [], sortOrder),
        bundles,
        expandedBundles,
        depth,
      ),
    );
  };
  walk(rootId, 0);

  return rows;
}
