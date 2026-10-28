'use client';

import { useRef, useState, type DragEvent } from 'react';
import {
  ACCEPT_ATTRIBUTE,
  FILE_CATEGORIES,
  FILE_EXTENSIONS,
  fileCategoryLabels,
  MAX_FILE_SIZE,
  validateFile,
} from '@/lib/fileTypes';
import { formatFileSize } from '@/lib/format';
import { FileBadge } from './FileBadge';

type Props = {
  id: string;
  file: File | null;
  onChange: (file: File | null) => void;
  // 編集時、すでに添付されているファイル名
  currentFileName?: string | null;
};

// クリックまたはドラッグ＆ドロップでファイルを選ぶ欄（選んだ時点で形式とサイズを確認する）
export function FileDropzone({ id, file, onChange, currentFileName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [showFormats, setShowFormats] = useState(false);

  function select(selected: File | null | undefined) {
    if (!selected) return;
    const message = validateFile(selected);
    setError(message ?? '');
    onChange(message ? null : selected);
  }

  function clear() {
    onChange(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    select(event.dataTransfer.files[0]);
  }

  return (
    <div className="space-y-1.5">
      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary bg-primary-soft/40 px-3 py-2.5">
          <FileBadge fileName={file.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{file.name}</p>
            <p className="text-xs text-muted">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="rounded px-2 py-1 text-xs text-primary hover:bg-primary-soft"
          >
            取り消す
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-3 py-4 text-center text-sm transition-colors ${
            dragOver
              ? 'border-primary bg-primary-soft'
              : 'border-border text-muted hover:border-primary hover:bg-surface-muted'
          }`}
        >
          <span className="font-bold text-foreground">
            ここにファイルをドロップ、またはクリックして選択
          </span>
          <span className="text-xs">
            文書・画像・動画・音声・プログラム・ZIP（{MAX_FILE_SIZE / 1024 / 1024}MBまで）
          </span>
        </label>
      )}

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={(event) => select(event.target.files?.[0])}
        className="sr-only"
      />

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {currentFileName && !file && (
        <p className="text-xs text-muted">
          現在のファイル：{currentFileName}（選択すると差し替え）
        </p>
      )}

      <button
        type="button"
        onClick={() => setShowFormats((v) => !v)}
        aria-expanded={showFormats}
        className="text-xs text-primary hover:underline"
      >
        {showFormats ? '対応形式を閉じる' : '対応しているファイル形式を見る'}
      </button>
      {showFormats && (
        <dl className="space-y-1 rounded-lg bg-surface-muted p-3 text-xs">
          {FILE_CATEGORIES.map((category) => (
            <div key={category} className="grid grid-cols-[5.5rem_1fr] gap-2">
              <dt className="font-bold">{fileCategoryLabels[category]}</dt>
              <dd className="text-muted">
                {FILE_EXTENSIONS[category].map((ext) => `.${ext}`).join(' ')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
