'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { inputClass } from '@/components/ui/FormField';
import { FolderOptions } from './FolderOptions';
import { folderColorLabels } from '@/components/ui/typeStyles';
import { folderColor } from '@/lib/folderColors';
import { folderDepth, subtreeIds, type FolderIndex } from '@/lib/folderTree';
import { deleteFolder, saveFolder } from '@/lib/materialsApi';
import {
  FOLDER_COLORS,
  MAX_FOLDER_DEPTH,
  MAX_FOLDER_NAME_LENGTH,
  type Folder,
  type FolderColor,
} from '@/types/material';

type Props = {
  // 編集するフォルダ（null なら新規作成）
  folder: Folder | null;
  // 新規作成時の親フォルダ（null は最上位）
  defaultParentId: number | null;
  folderIndex: FolderIndex;
  onClose: () => void;
  onSaved: (message: string, folder: Folder | null) => void;
};

export function FolderDialog({
  folder,
  defaultParentId,
  folderIndex,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(folder?.name ?? '');
  const [color, setColor] = useState<FolderColor>(
    folder?.color ?? (defaultParentId !== null ? folderIndex.byId.get(defaultParentId)?.color : undefined) ?? 'blue',
  );
  const [parentId, setParentId] = useState<number | null>(
    folder ? folder.parent_id : defaultParentId,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました。');
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const saved = await saveFolder({ name, color, parent_id: parentId }, folder?.id);
      onSaved(folder ? 'フォルダを更新しました。' : 'フォルダを作成しました。', saved);
    });
  }

  function handleDelete() {
    if (!folder) return;
    void run(async () => {
      await deleteFolder(folder.id);
      onSaved(`フォルダを削除しました。中身は${destination}へ移動しました。`, null);
    });
  }

  // 自分自身と子孫の中へは移動できない
  const excluded = folder ? subtreeIds(folderIndex, folder.id) : undefined;
  // 移動するフォルダの木の高さ（自分を含む）。親の深さ + これ が上限を超える場所は選べない
  const height = folder ? subtreeHeight(folderIndex, folder.id) : 1;
  const parent = folder?.parent_id != null ? folderIndex.byId.get(folder.parent_id) : undefined;
  const destination = parent ? `「${parent.name}」` : '未分類（最上位）';
  const childCount = folder ? (folderIndex.children.get(folder.id) ?? []).length : 0;

  return (
    <Dialog title={folder ? 'フォルダを編集' : 'フォルダを作成'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="folder-name" className="block text-sm font-bold">
            フォルダ名
          </label>
          <input
            id="folder-name"
            required
            autoFocus
            maxLength={MAX_FOLDER_NAME_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例：1年前期、試験対策まとめ"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="folder-parent" className="block text-sm font-bold">
            場所
          </label>
          <select
            id="folder-parent"
            value={parentId ?? ''}
            onChange={(event) =>
              setParentId(event.target.value ? Number(event.target.value) : null)
            }
            className={inputClass}
          >
            <option value="">最上位</option>
            <FolderOptions
              index={folderIndex}
              exclude={excluded}
              disableFromDepth={MAX_FOLDER_DEPTH - height}
            />
          </select>
          {parentId !== null && (
            <p className="text-xs text-muted">
              {folderDepth(folderIndex, parentId) + 1}階層目（{MAX_FOLDER_DEPTH}階層まで作成できます）
            </p>
          )}
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">色</legend>
          <div className="flex flex-wrap gap-1.5">
            {FOLDER_COLORS.map((value) => (
              <label key={value} title={folderColorLabels[value]} className="cursor-pointer">
                <input
                  type="radio"
                  name="folder-color"
                  value={value}
                  checked={color === value}
                  onChange={() => setColor(value)}
                  className="peer sr-only"
                />
                <span
                  style={{ background: folderColor(value) }}
                  className="block size-7 rounded-md ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                />
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {confirmingDelete ? (
          <div className="space-y-3 rounded-lg bg-danger-soft p-3 text-sm">
            <p className="text-danger">
              「{folder?.name}」を削除しますか？中の教材（{folder?.materials_count}件）
              {childCount > 0 && `とフォルダ（${childCount}個）`}は削除されず、{destination}
              へ移動します。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                やめる
              </Button>
              <Button variant="solid-danger" onClick={handleDelete} disabled={busy}>
                削除する
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            {folder && (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                削除
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                キャンセル
              </Button>
              <Button type="submit" disabled={busy}>
                {folder ? '保存' : '作成'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  );
}

// 指定フォルダを根とする木の高さ（自分だけなら 1）
function subtreeHeight(index: FolderIndex, id: number): number {
  const children = index.children.get(id) ?? [];
  return 1 + Math.max(0, ...children.map((child) => subtreeHeight(index, child.id)));
}
