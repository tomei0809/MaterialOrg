'use client';

import { useState, type FormEvent } from 'react';
import { FolderOptions } from '@/components/folders/FolderOptions';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FileBadge } from '@/components/ui/FileBadge';
import { inputClass } from '@/components/ui/FormField';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { validateFile } from '@/lib/fileTypes';
import type { FolderIndex } from '@/lib/folderTree';
import { formatFileSize } from '@/lib/format';
import { saveMaterial } from '@/lib/materialsApi';
import {
  MATERIAL_TYPES,
  typeLabels,
  type MaterialFormValues,
  type MaterialType,
} from '@/types/material';

type Status = 'waiting' | 'uploading' | 'done' | 'error' | 'skipped';

type Item = {
  file: File;
  title: string;
  // 形式・サイズのチェックで登録できないときの理由
  invalid: string | null;
  status: Status;
  error?: string;
};

type Props = {
  files: File[];
  // 表示中の種類・フォルダ（初期値）
  defaults: Pick<MaterialFormValues, 'material_type' | 'folder_id'>;
  folderIndex: FolderIndex;
  onClose: () => void;
  // 1件以上登録したら一覧を読み直す
  onDone: (message: string) => void;
};

// ファイル名から拡張子を除いて教材名の初期値にする
export function titleFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || name;
}

const statusLabels: Record<Status, string> = {
  waiting: '待機中',
  uploading: '登録中',
  done: '登録済み',
  error: '失敗',
  skipped: '対象外',
};

// 画面にドロップされた複数のファイルを、共通の種類・フォルダでまとめて登録する
export function UploadQueueDialog({
  files,
  defaults,
  folderIndex,
  onClose,
  onDone,
}: Props) {
  const [items, setItems] = useState<Item[]>(() =>
    files.map((file) => {
      const invalid = validateFile(file);
      return {
        file,
        title: titleFromFileName(file.name),
        invalid,
        status: invalid ? 'skipped' : 'waiting',
      };
    }),
  );
  const [type, setType] = useState<MaterialType>(defaults.material_type);
  const [folderId, setFolderId] = useState(defaults.folder_id);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  const targets = items.filter((item) => !item.invalid);
  const doneCount = items.filter((item) => item.status === 'done').length;

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunning(true);

    let succeeded = 0;
    // 失敗したものだけを再実行できるよう、登録済みは飛ばす
    for (const [index, item] of items.entries()) {
      if (item.invalid || item.status === 'done') continue;
      updateItem(index, { status: 'uploading', error: undefined });
      try {
        await saveMaterial(
          {
            title: item.title.trim() || titleFromFileName(item.file.name),
            material_type: type,
            description: '',
            tags: [],
            folder_id: folderId,
          },
          item.file,
        );
        updateItem(index, { status: 'done' });
        succeeded += 1;
      } catch (err) {
        updateItem(index, {
          status: 'error',
          error: err instanceof Error ? err.message : '登録できませんでした。',
        });
      }
    }

    setRunning(false);
    setFinished(true);
    if (succeeded > 0) onDone(`${succeeded}件の教材を登録しました。`);
  }

  const failed = items.some((item) => item.status === 'error');

  return (
    <Dialog title={`${files.length}件のファイルを登録`} onClose={running ? () => {} : onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="space-y-1.5">
            <label htmlFor="queue-folder" className="block text-sm font-bold">
              フォルダ
            </label>
            <select
              id="queue-folder"
              value={folderId}
              onChange={(event) => setFolderId(event.target.value)}
              disabled={running}
              className={inputClass}
            >
              <option value="">未分類</option>
              <FolderOptions index={folderIndex} />
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">教材の種類</legend>
          <div className="flex flex-wrap gap-1.5">
            {MATERIAL_TYPES.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-sm ${
                  type === value ? 'border-primary bg-primary-soft font-bold' : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="queue-type"
                  checked={type === value}
                  onChange={() => setType(value)}
                  disabled={running}
                  className="sr-only"
                />
                <TypeIcon type={value} />
                {typeLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <p className="mb-1.5 text-sm font-bold">教材名（ファイルごとに変更できます）</p>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {items.map((item, index) => (
              <li key={`${item.file.name}-${index}`} className="flex items-center gap-2 px-3 py-2">
                <FileBadge fileName={item.file.name} />
                <div className="min-w-0 flex-1">
                  {item.invalid ? (
                    <p className="truncate text-sm text-muted line-through">{item.file.name}</p>
                  ) : (
                    <input
                      aria-label={`${item.file.name} の教材名`}
                      value={item.title}
                      onChange={(event) => updateItem(index, { title: event.target.value })}
                      disabled={running || item.status === 'done'}
                      className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm hover:border-border focus:border-primary focus:outline-none"
                    />
                  )}
                  <p className="truncate px-1.5 text-xs text-muted">
                    {item.invalid ?? item.error ?? `${item.file.name}（${formatFileSize(item.file.size)}）`}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs ${
                    item.status === 'done'
                      ? 'text-success'
                      : item.status === 'error'
                        ? 'text-danger'
                        : item.status === 'uploading'
                          ? 'text-primary'
                          : 'text-muted'
                  }`}
                >
                  {statusLabels[item.status]}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            登録できるのは{targets.length}件です
            {targets.length < items.length && `（${items.length - targets.length}件は形式・サイズが対象外）`}。
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          {finished && !failed ? (
            <Button onClick={onClose}>閉じる</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={running}>
                {finished ? '閉じる' : 'キャンセル'}
              </Button>
              <Button type="submit" disabled={running || targets.length === 0}>
                {running
                  ? `登録中（${doneCount}/${targets.length}）`
                  : failed
                    ? '失敗したものを再登録'
                    : `${targets.length}件を登録`}
              </Button>
            </>
          )}
        </div>
      </form>
    </Dialog>
  );
}
