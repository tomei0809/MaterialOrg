// Rails API（/api/v1/materials）の呼び出しをまとめたモジュール
// /api/* は next.config.ts の rewrites で Rails に転送される

import type {
  Bundle,
  Folder,
  FolderColor,
  Material,
  MaterialFilters,
  MaterialFormValues,
  Tag,
} from '@/types/material';

const BASE_URL = '/api/v1/materials';
const TAGS_URL = '/api/v1/tags';
const FOLDERS_URL = '/api/v1/folders';
const BUNDLES_URL = '/api/v1/bundles';

// エラー時は Rails の { errors: [...] } を優先してメッセージにする
async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { errors?: string[] }).errors?.join('、') ?? fallback);
  }

  return data as T;
}

export async function fetchMaterials(
  filters: MaterialFilters = {},
): Promise<Material[]> {
  const query = new URLSearchParams();

  if (filters.title) query.set('title', filters.title);
  if (filters.material_type) query.set('material_type', filters.material_type);
  if (filters.tag) query.set('tag', filters.tag);

  const queryString = query.toString();
  const response = await fetch(
    queryString ? `${BASE_URL}?${queryString}` : BASE_URL,
  );

  if (!response.ok) {
    throw new Error(
      '教材一覧を取得できませんでした。RailsサーバーとAPIの設定を確認してください。',
    );
  }

  return response.json();
}

// id があれば更新（PATCH）、なければ新規登録（POST）
export async function saveMaterial(
  values: MaterialFormValues,
  file: File | null,
  id?: number,
): Promise<Material> {
  const isEditing = id !== undefined;

  // 教材情報とファイルを一緒に送信する
  const body = new FormData();
  body.append('material[title]', values.title);
  body.append('material[material_type]', values.material_type);
  body.append('material[description]', values.description);
  body.append('material[folder_id]', values.folder_id);
  // タグが0個のときも空文字を1つ送り、「すべて外す」をRailsに伝える
  (values.tags.length > 0 ? values.tags : ['']).forEach((tag) =>
    body.append('material[tag_names][]', tag),
  );
  if (file) body.append('material[file]', file);

  const response = await fetch(isEditing ? `${BASE_URL}/${id}` : BASE_URL, {
    method: isEditing ? 'PATCH' : 'POST',
    body,
  });

  return parseResponse<Material>(
    response,
    isEditing ? '教材を更新できませんでした。' : '教材を登録できませんでした。',
  );
}

// 教材の一部の項目だけを変更する（右クリックメニューの簡易編集。ファイルは送らない）
export function updateMaterialFields(
  material: Material,
  patch: Partial<Pick<MaterialFormValues, 'title' | 'material_type' | 'tags'>>,
): Promise<Material> {
  return saveMaterial(
    {
      title: material.title,
      material_type: material.material_type,
      description: material.description ?? '',
      tags: material.tags,
      folder_id: material.folder_id === null ? '' : String(material.folder_id),
      ...patch,
    },
    null,
    material.id,
  );
}

// 複数の教材をお気に入りに入れる／外す
export async function setFavorite(ids: number[], favorite: boolean) {
  const response = await fetch(`${BASE_URL}/favorite`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, favorite }),
  });
  return parseResponse<{ updated: number }>(response, 'お気に入りを変更できませんでした。');
}

// 教材を開いたことを記録する（「最近使った資料」）
export async function markOpened(id: number) {
  const response = await fetch(`${BASE_URL}/${id}/opened`, { method: 'PATCH' });
  return parseResponse<{ id: number; last_opened_at: string }>(response, '開いた記録を保存できませんでした。');
}

// 複数の教材をまとめてフォルダへ移動する（folderId が null なら未分類へ）
export async function moveMaterials(ids: number[], folderId: number | null) {
  const response = await fetch(`${BASE_URL}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, folder_id: folderId ?? '' }),
  });

  return parseResponse<{ moved: number }>(response, '教材を移動できませんでした。');
}

// 教材をゴミ箱へ移す（30日間は restoreMaterials で元に戻せる）
export async function deleteMaterial(id: number): Promise<void> {
  const response = await fetch(`${BASE_URL}/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error('教材をゴミ箱へ移動できませんでした。');
  }
}

// ゴミ箱の教材（削除した日時の新しい順）
export async function fetchTrash(): Promise<Material[]> {
  const response = await fetch(`${BASE_URL}/trash`, { cache: 'no-store' });
  return parseResponse<Material[]>(response, 'ゴミ箱を読み込めませんでした。');
}

export async function restoreMaterials(ids: number[]) {
  const response = await fetch(`${BASE_URL}/restore`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parseResponse<{ restored: number }>(response, '教材を元に戻せませんでした。');
}

// ゴミ箱の教材を完全に削除する（'all' はゴミ箱を空にする）。元に戻せない
export async function purgeMaterials(ids: number[] | 'all') {
  const response = await fetch(`${BASE_URL}/purge`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
  });
  return parseResponse<{ purged: number }>(response, '教材を完全に削除できませんでした。');
}

// 教材に使われているタグ（使用数の多い順）
export async function fetchTags(): Promise<Tag[]> {
  const response = await fetch(TAGS_URL);

  if (!response.ok) {
    throw new Error('タグ一覧を取得できませんでした。');
  }

  return response.json();
}

export async function fetchFolders(): Promise<Folder[]> {
  const response = await fetch(FOLDERS_URL);
  return parseResponse<Folder[]>(response, 'フォルダ一覧を取得できませんでした。');
}

// id があれば更新、なければ作成
export async function saveFolder(
  values: { name: string; color: FolderColor; parent_id: number | null },
  id?: number,
): Promise<Folder> {
  const response = await fetch(id ? `${FOLDERS_URL}/${id}` : FOLDERS_URL, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: values }),
  });

  return parseResponse<Folder>(
    response,
    id ? 'フォルダを更新できませんでした。' : 'フォルダを作成できませんでした。',
  );
}

// parentId（null は最上位）の中を folderIds の順に並べる。別の親のフォルダを含めると、その中へ移動する。
// 移動先に今あるフォルダはすべて folderIds に含める
export async function arrangeFolders(
  parentId: number | null,
  folderIds: number[],
): Promise<Folder[]> {
  const response = await fetch(`${FOLDERS_URL}/arrange`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parent_id: parentId, folder_ids: folderIds }),
  });
  return parseResponse<Folder[]>(response, 'フォルダを移動できませんでした。');
}

// フォルダ内の教材は削除されず未分類に戻る
export async function deleteFolder(id: number): Promise<void> {
  const response = await fetch(`${FOLDERS_URL}/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error('フォルダを削除できませんでした。');
  }
}

// --- まとめ（複数の教材を一覧で1行に束ねて表示する）---

export async function fetchBundles(): Promise<Bundle[]> {
  const response = await fetch(BUNDLES_URL);
  return parseResponse<Bundle[]>(response, 'まとめの一覧を取得できませんでした。');
}

const jsonRequest = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// 教材を指定してまとめを作成する（別のまとめに入っていた教材は移ってくる）
export async function createBundle(name: string, materialIds: number[]): Promise<Bundle> {
  const response = await fetch(
    BUNDLES_URL,
    jsonRequest('POST', { bundle: { name, material_ids: materialIds } }),
  );
  return parseResponse<Bundle>(response, 'まとめを作成できませんでした。');
}

export async function renameBundle(id: number, name: string): Promise<Bundle> {
  const response = await fetch(`${BUNDLES_URL}/${id}`, jsonRequest('PATCH', { bundle: { name } }));
  return parseResponse<Bundle>(response, 'まとめの名前を変更できませんでした。');
}

// まとめを解除する（教材は削除されない）
export async function deleteBundle(id: number): Promise<void> {
  const response = await fetch(`${BUNDLES_URL}/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('まとめを解除できませんでした。');
}

// 教材を既存のまとめに入れる（bundleId が null ならまとめから外す）
export async function assignBundle(ids: number[], bundleId: number | null) {
  const response = await fetch(
    `${BASE_URL}/assign_bundle`,
    jsonRequest('PATCH', { ids, bundle_id: bundleId ?? '' }),
  );
  return parseResponse<{ updated: number }>(response, 'まとめを変更できませんでした。');
}

// まとめの中身を ids の順に並べ替える（中身すべての ID を渡す）
export async function reorderBundle(id: number, materialIds: number[]): Promise<Bundle> {
  const response = await fetch(
    `${BUNDLES_URL}/${id}/reorder`,
    jsonRequest('PATCH', { material_ids: materialIds }),
  );
  return parseResponse<Bundle>(response, 'まとめの並び順を変更できませんでした。');
}
