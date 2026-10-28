'use client';

import { useEffect, useState } from 'react';
import { fileCategory, fileExtension, isTextPreviewable } from '@/lib/fileTypes';
import { formatFileSize } from '@/lib/format';
import type { Material } from '@/types/material';

// テキストとして読み込んで表示する上限（大きなファイルは開いて確認してもらう）
const MAX_TEXT_PREVIEW = 512 * 1024;
const MAX_TEXT_LINES = 2000;

function TextPreview({ url }: { url: string }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'done'; text: string } | { status: 'error' }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.text();
      })
      .then((text) => {
        if (active) setState({ status: 'done', text });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (state.status === 'loading') {
    return <p className="text-xs text-muted">プレビューを読み込んでいます...</p>;
  }
  if (state.status === 'error') {
    return <p className="text-xs text-danger">プレビューを読み込めませんでした。</p>;
  }

  const lines = state.text.split(/\r?\n/);
  const shown = lines.slice(0, MAX_TEXT_LINES);

  return (
    <div>
      <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-surface-muted py-2 font-mono text-xs leading-relaxed">
        <code className="grid grid-cols-[auto_1fr]">
          {shown.map((line, i) => (
            <span key={i} className="contents">
              <span className="select-none pr-3 pl-3 text-right text-muted/70 tabular-nums">
                {i + 1}
              </span>
              <span className="pr-3 whitespace-pre">{line || ' '}</span>
            </span>
          ))}
        </code>
      </pre>
      {lines.length > MAX_TEXT_LINES && (
        <p className="mt-1 text-xs text-muted">
          先頭の{MAX_TEXT_LINES}行だけを表示しています（全{lines.length}行）。
        </p>
      )}
    </div>
  );
}

// 詳細パネルで添付ファイルの中身をその場で確認できるようにする
// 親側で key={material.id} を付け、教材が切り替わったら作り直す
export function FilePreview({ material }: { material: Material }) {
  const url = material.file_url;
  const name = material.file_name;
  if (!material.file_attached || !url) return null;

  const category = fileCategory(name);
  const ext = fileExtension(name);
  const size = material.file_size ?? 0;

  switch (category) {
    case 'image':
      // HEIC は多くのブラウザで表示できないため、開いて確認してもらう
      if (ext === 'heic' || ext === 'heif') return null;
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- Rails から配信する任意の画像のため next/image の最適化は使わない */}
          <img
            src={url}
            alt={name ?? material.title}
            loading="lazy"
            className="max-h-80 w-full rounded-lg border border-border bg-surface-muted object-contain"
          />
        </a>
      );
    case 'video':
      return (
        <video
          src={url}
          controls
          preload="metadata"
          className="max-h-80 w-full rounded-lg bg-black"
        >
          この形式の動画はブラウザで再生できません。「開く」から保存して確認してください。
        </video>
      );
    case 'audio':
      return <audio src={url} controls preload="metadata" className="w-full" />;
    case 'document':
      if (ext === 'pdf') {
        return (
          <iframe
            src={url}
            title={name ?? material.title}
            className="h-96 w-full rounded-lg border border-border bg-white"
          />
        );
      }
      break;
  }

  if (isTextPreviewable(name)) {
    return size > MAX_TEXT_PREVIEW ? (
      <p className="text-xs text-muted">
        ファイルが大きいため（{formatFileSize(size)}）プレビューは表示していません。
      </p>
    ) : (
      <TextPreview url={url} />
    );
  }

  return null;
}
