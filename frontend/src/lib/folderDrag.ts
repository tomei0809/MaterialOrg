// フォルダのドラッグ（並び替え・別のフォルダの中への移動）の計算

import { MAX_FOLDER_DEPTH } from '@/types/material';
import { folderDepth, subtreeIds, type FolderIndex } from './folderTree';

// dataTransfer に入れるフォルダIDの種類（教材の DRAG_TYPE とは別）
export const FOLDER_DRAG_TYPE = 'application/x-mateorg-folder-id';

// 重ねた位置：相手の前／中／後ろ
export type FolderDropZone = 'before' | 'inside' | 'after';

// arrangeFolders に渡す内容：parentId の中を folderIds の順に並べる
export type FolderDropPlan = { parentId: number | null; folderIds: number[] };

// 行の上 1/4 なら前、下 1/4 なら後ろ、それ以外は中
export function zoneFromPointer(clientY: number, rect: DOMRect): FolderDropZone {
  const offset = clientY - rect.top;
  if (offset < rect.height / 4) return 'before';
  if (offset > (rect.height * 3) / 4) return 'after';
  return 'inside';
}

// 自分を含めた部分木の段数（自分だけなら 1）
function subtreeHeight(index: FolderIndex, id: number): number {
  const children = index.children.get(id) ?? [];
  return 1 + Math.max(0, ...children.map((child) => subtreeHeight(index, child.id)));
}

// draggedId を targetId（null は最上位の見出し＝最上位の末尾）に重ねたときの並べ方。
// 自分や自分の中への移動・階層の上限超え・同じ名前のフォルダがある場所・何も変わらない場合は null
export function planFolderDrop(
  index: FolderIndex,
  draggedId: number,
  targetId: number | null,
  zone: FolderDropZone,
): FolderDropPlan | null {
  const dragged = index.byId.get(draggedId);
  if (!dragged) return null;
  if (targetId !== null && subtreeIds(index, draggedId).has(targetId)) return null;

  const target = targetId !== null ? index.byId.get(targetId) : undefined;
  if (targetId !== null && !target) return null;

  const parentId = target === undefined ? null : zone === 'inside' ? target.id : target.parent_id;
  const parentDepth = parentId === null ? 0 : folderDepth(index, parentId);
  if (parentDepth + subtreeHeight(index, draggedId) > MAX_FOLDER_DEPTH) return null;

  const current = (index.children.get(parentId) ?? []).map((f) => f.id);
  const siblings = current.filter((id) => id !== draggedId);
  if (parentId !== dragged.parent_id) {
    const conflict = siblings.some((id) => index.byId.get(id)?.name === dragged.name);
    if (conflict) return null;
  }

  let folderIds: number[];
  if (target === undefined || zone === 'inside') {
    // 中へ入れるときは末尾に置く（すでにその中にあるなら動かさない）
    if (parentId === dragged.parent_id) return null;
    folderIds = [...siblings, draggedId];
  } else {
    const at = siblings.indexOf(target.id);
    folderIds = [...siblings];
    folderIds.splice(zone === 'after' ? at + 1 : at, 0, draggedId);
  }

  const unchanged =
    parentId === dragged.parent_id &&
    folderIds.length === current.length &&
    folderIds.every((id, i) => id === current[i]);
  return unchanged ? null : { parentId, folderIds };
}
