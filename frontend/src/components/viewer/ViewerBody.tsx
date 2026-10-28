'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLoaded } from '@/components/preview/hooks';
import { fileBadgeLabel, fileCategory, fileExtension, isTextPreviewable } from '@/lib/fileTypes';
import { formatFileSize } from '@/lib/format';
import { OFFICE_EXTENSIONS } from '@/lib/officeText';
import { cached, fetchBuffer } from '@/lib/previewCache';
import { listZip, readZipEntry, type ZipEntry } from '@/lib/zip';
import { ImageViewer } from './ImageViewer';
import { MediaViewer } from './MediaViewer';
import { OfficeViewer } from './OfficeViewer';
import { PdfViewer } from './PdfViewer';
import { TextViewer } from './TextViewer';
import { ViewerMessage } from './ViewerParts';

// ビューアで開くファイル（教材の添付ファイル、または ZIP の中のファイル）
export type ViewerSource = { url: string; name: string; size: number };

// 中身を読まずに情報だけ出す大きさ
const MAX_OFFICE = 50 * 1024 * 1024;
const MAX_TEXT = 5 * 1024 * 1024;
const MAX_ZIP_ENTRY = 50 * 1024 * 1024;

function InfoPanel({ source, note }: { source: ViewerSource; note: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="rounded border-2 border-foreground px-3 py-1 text-lg font-bold">{fileBadgeLabel(source.name)}</span>
      <p className="text-sm font-bold">{source.name}</p>
      <p className="text-xs text-muted">{formatFileSize(source.size)}</p>
      <p className="max-w-md text-sm text-muted">{note}</p>
    </div>
  );
}

// 形式ごとに見せ方を振り分ける
export function ViewerBody({ source }: { source: ViewerSource }) {
  const ext = fileExtension(source.name);
  const category = fileCategory(source.name);

  if (category === 'image') {
    if (ext === 'heic' || ext === 'heif') {
      return <InfoPanel source={source} note="HEIC の写真はブラウザで表示できません。「保存」してから写真アプリで開いてください。" />;
    }
    return <ImageViewer url={source.url} alt={source.name} />;
  }
  if (ext === 'pdf') return <PdfViewer url={source.url} />;
  if (category === 'video' || category === 'audio') {
    return <MediaViewer url={source.url} kind={category} size={source.size} name={source.name} />;
  }
  if (OFFICE_EXTENSIONS.includes(ext)) {
    if (source.size > MAX_OFFICE) return <InfoPanel source={source} note="大きいファイルのため、中身は表示していません。「保存」から開いてください。" />;
    return <OfficeViewer url={source.url} ext={ext} />;
  }
  if (category === 'archive') return <ZipViewer source={source} />;
  if (isTextPreviewable(source.name) || ext === 'ipynb') {
    if (source.size > MAX_TEXT) return <InfoPanel source={source} note="大きいファイルのため、中身は表示していません。「保存」から開いてください。" />;
    return <TextViewer url={source.url} ext={ext} />;
  }
  return (
    <InfoPanel
      source={source}
      note={
        ['doc', 'ppt', 'xls', 'rtf'].includes(ext)
          ? '古い Office 形式・RTF は中身を表示できません。「保存」して Office で開いてください。'
          : 'この形式は中身を表示できません。「保存」から開いてください。'
      }
    />
  );
}

type TreeNode = { name: string; path: string; entry?: ZipEntry; children: Map<string, TreeNode> };

function buildTree(entries: ZipEntry[]) {
  const root: TreeNode = { name: '', path: '', children: new Map() };
  for (const entry of entries) {
    const parts = entry.name.split('/').filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join('/');
      if (!node.children.has(part)) node.children.set(part, { name: part, path, children: new Map() });
      node = node.children.get(part)!;
    });
    if (!entry.name.endsWith('/')) node.entry = entry;
  }
  return root;
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

function TreeView({ node, depth, selected, onSelect }: { node: TreeNode; depth: number; selected: string | null; onSelect: (n: TreeNode) => void }) {
  const children = [...node.children.values()].sort(
    (a, b) => Number(Boolean(a.entry)) - Number(Boolean(b.entry)) || a.name.localeCompare(b.name, 'ja'),
  );
  return (
    <ul>
      {children.map((child) => (
        <li key={child.path}>
          {child.entry ? (
            <button
              type="button"
              onClick={() => onSelect(child)}
              aria-current={selected === child.path ? 'true' : undefined}
              className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-left text-xs ${selected === child.path ? 'bg-primary-soft font-bold' : 'hover:bg-surface-muted'}`}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <span className="min-w-0 flex-1 truncate">{child.name}</span>
              <span className="shrink-0 text-[10px] text-muted tabular-nums">{formatFileSize(child.entry.size)}</span>
            </button>
          ) : (
            <>
              <p className="flex items-center gap-1 py-1 text-xs font-bold text-muted" style={{ paddingLeft: 8 + depth * 14 }}>
                <span aria-hidden="true">▾</span> {child.name}
              </p>
              <TreeView node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// ZIP：左に中のファイルの木、右に選んだファイルの中身
function ZipViewer({ source }: { source: ViewerSource }) {
  const zip = useLoaded(`zipview:${source.url}`, () =>
    cached(`zipview:${source.url}`, async () => {
      const buffer = await fetchBuffer(source.url);
      return { buffer, entries: listZip(buffer) };
    }),
  );
  const tree = useMemo(() => (zip.status === 'done' ? buildTree(zip.value.entries) : null), [zip]);
  const [selected, setSelected] = useState<{ path: string; source: ViewerSource } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // 取り出したファイルの URL は、選び直したときと閉じたときに片付ける
  useEffect(() => () => {
    if (selected) URL.revokeObjectURL(selected.source.url);
  }, [selected]);

  if (zip.status === 'loading') return <ViewerMessage>ZIP を読み込んでいます…</ViewerMessage>;
  if (zip.status === 'error' || !tree) return <ViewerMessage>ZIP の中身を読めませんでした。「保存」から開いてください。</ViewerMessage>;

  const open = async (node: TreeNode) => {
    const entry = node.entry;
    if (!entry) return;
    if (entry.size > MAX_ZIP_ENTRY) {
      setSelected({ path: node.path, source: { url: '', name: node.name, size: entry.size } });
      return;
    }
    setOpening(node.path);
    try {
      const bytes = await readZipEntry(zip.value.buffer, entry);
      const blob = new Blob([bytes.slice()], { type: MIME[fileExtension(node.name)] ?? 'application/octet-stream' });
      setSelected({ path: node.path, source: { url: URL.createObjectURL(blob), name: node.name, size: entry.size } });
    } finally {
      setOpening(null);
    }
  };

  const files = zip.value.entries.filter((e) => !e.name.endsWith('/')).length;
  return (
    <div className="flex h-full">
      <nav aria-label="ZIP の中のファイル" className="w-72 shrink-0 overflow-y-auto border-r border-border bg-surface p-2">
        <p className="px-2 pb-1 text-xs text-muted">{files}個のファイル</p>
        <TreeView node={tree} depth={0} selected={selected?.path ?? null} onSelect={(n) => void open(n)} />
      </nav>
      <div className="min-w-0 flex-1">
        {opening ? (
          <ViewerMessage>取り出しています…</ViewerMessage>
        ) : selected ? (
          selected.source.url ? (
            <ViewerBody key={selected.path} source={selected.source} />
          ) : (
            <InfoPanel source={selected.source} note="大きいファイルのため、ZIP を保存してから開いてください。" />
          )
        ) : (
          <ViewerMessage>左の一覧からファイルを選ぶと、ここに中身を表示します</ViewerMessage>
        )}
      </div>
    </div>
  );
}
