'use client';

import { useState, type FormEvent } from 'react';
import { FolderOptions } from '@/components/folders/FolderOptions';
import { Button } from '@/components/ui/Button';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { FormField, inputClass } from '@/components/ui/FormField';
import { TagInput } from '@/components/ui/TagInput';
import { TypeIcon } from '@/components/ui/TypeIcon';
import type { FolderIndex } from '@/lib/folderTree';
import { saveMaterial } from '@/lib/materialsApi';
import {
  initialFormValues,
  MATERIAL_TYPES,
  typeLabels,
  type Material,
  type MaterialFormValues,
} from '@/types/material';

function toFormValues(
  material: Material | null,
  defaults: Partial<MaterialFormValues>,
): MaterialFormValues {
  if (!material) return { ...initialFormValues, ...defaults };

  return {
    title: material.title,
    material_type: material.material_type,
    description: material.description ?? '',
    tags: material.tags,
    folder_id: material.folder_id?.toString() ?? '',
  };
}

type Props = {
  // 編集する教材（null なら新規登録）
  // 親側で key を変えることで、対象が切り替わるたびに入力値を初期化する
  material: Material | null;
  // 新規登録時の初期値（表示中のフォルダ・種類タブを引き継ぐ）
  defaults: Partial<MaterialFormValues>;
  // 画面にドロップされたファイル（あれば最初から添付しておく）
  initialFile?: File | null;
  folderIndex: FolderIndex;
  tagSuggestions: string[];
  onSaved: (message: string) => void;
  onCancel: () => void;
};

export function MaterialForm({
  material,
  defaults,
  initialFile = null,
  folderIndex,
  tagSuggestions,
  onSaved,
  onCancel,
}: Props) {
  const isEditing = material !== null;
  const [values, setValues] = useState(() => toFormValues(material, defaults));
  const [file, setFile] = useState<File | null>(initialFile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function update<K extends keyof MaterialFormValues>(
    key: K,
    value: MaterialFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await saveMaterial(values, file, material?.id);
      onSaved(isEditing ? '教材を更新しました。' : '教材を登録しました。');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '予期しないエラーが発生しました。',
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
      <div className="flex-1 space-y-4 px-5 py-5">
        <FormField id="title" label="教材名" required>
          <input
            id="title"
            required
            autoFocus
            value={values.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder="例：情報数学 第1回"
            className={inputClass}
          />
        </FormField>

        <FormField id="folder_id" label="フォルダ">
          <select
            id="folder_id"
            value={values.folder_id}
            onChange={(event) => update('folder_id', event.target.value)}
            className={inputClass}
          >
            <option value="">未分類</option>
            <FolderOptions index={folderIndex} />
          </select>
        </FormField>

        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-sm font-bold">
            教材の種類<span className="ml-1 text-xs text-danger">必須</span>
          </legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {MATERIAL_TYPES.map((type) => {
              const checked = values.material_type === type;
              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                    checked
                      ? 'border-primary bg-primary-soft font-bold'
                      : 'border-border hover:bg-surface-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="material_type"
                    value={type}
                    checked={checked}
                    onChange={() => update('material_type', type)}
                    className="sr-only"
                  />
                  <TypeIcon type={type} />
                  {typeLabels[type]}
                </label>
              );
            })}
          </div>
        </fieldset>

        <FormField id="tags" label="タグ">
          <TagInput
            id="tags"
            value={values.tags}
            onChange={(tags) => update('tags', tags)}
            suggestions={tagSuggestions}
          />
        </FormField>

        <FormField id="description" label="説明">
          <textarea
            id="description"
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="教材についての補足"
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </FormField>

        <FormField id="file" label="教材ファイル">
          <FileDropzone
            id="file"
            file={file}
            onChange={setFile}
            currentFileName={material?.file_name}
          />
        </FormField>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface px-5 py-3">
        <Button variant="secondary" onClick={onCancel} disabled={submitting} className="flex-1">
          キャンセル
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting
            ? isEditing
              ? '更新中...'
              : '登録中...'
            : isEditing
              ? '変更を保存'
              : '登録する'}
        </Button>
      </div>
    </form>
  );
}
