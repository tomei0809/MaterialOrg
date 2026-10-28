'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { sortBundleMembers } from '@/lib/bundles';
import { folderColor } from '@/lib/folderColors';
import { fileBadgeLabel, fileCategory, fileExtension, isTextPreviewable, languageName } from '@/lib/fileTypes';
import { formatFileSize } from '@/lib/format';
import { OFFICE_EXTENSIONS } from '@/lib/officeText';
import type { Bundle, Folder, Material } from '@/types/material';
import { CodeScroll } from './CodeScroll';
import { useAutoAdvance } from './hooks';
import { OfficePreview, ZipListPreview } from './OfficePreview';
import { PdfSlides } from './PdfSlides';
import { PreviewMessage, SlideCounter } from './PreviewParts';

// カーソルを合わせてから出すまでの時間（行の上を通り過ぎただけでは出さない）
const DELAY = 450;
const WIDTH = 380;
const BODY_HEIGHT = 240;
const HEADER_HEIGHT = 44;
// これより大きいファイルは中身を読まずに情報だけ出す
const MAX_BINARY = 50 * 1024 * 1024;
const MAX_TEXT = 512 * 1024;

export type PreviewTarget =
  | { kind: 'material'; material: Material }
  | { kind: 'bundle'; bundle: Bundle; members: Material[] };

type Props = {
  target: PreviewTarget;
  folders: Map<number, Folder>;
  // カーソルを合わせた行の位置と、そのときのカーソルの横位置
  rowRect: { top: number; bottom: number };
  pointerX: number;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// 中身を見せられない形式の情報（音声・古い Office 形式・大きすぎるファイルなど）
function InfoCard({ material, note, children }: { material: Material; note?: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
      <TypeIcon type={material.material_type} />
      <p className="text-xs">
        <span className="font-bold">{fileBadgeLabel(material.file_name)}</span>
        {material.file_size ? `　${formatFileSize(material.file_size)}` : ''}
      </p>
      {children}
      {note && <p className="text-[11px] text-muted">{note}</p>}
    </div>
  );
}

function AudioInfo({ material, url }: { material: Material; url: string }) {
  const [duration, setDuration] = useState<number | null>(null);
  return (
    <InfoCard material={material} note="音声は詳細パネルで再生できます">
      {/* 長さだけを読み取る（音は出さない） */}
      <audio src={url} preload="metadata" muted onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} className="hidden" />
      <p className="text-2xl font-bold tabular-nums">{duration !== null ? formatDuration(duration) : '‒:‒‒'}</p>
    </InfoCard>
  );
}

function VideoLoop({ url }: { url: string }) {
  const [time, setTime] = useState({ current: 0, total: NaN });
  return (
    <div className="relative h-full bg-black">
      <video
        src={url}
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => setTime({ current: e.currentTarget.currentTime, total: e.currentTarget.duration })}
        className="h-full w-full object-contain"
      />
      {Number.isFinite(time.total) && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/70 px-2 text-[11px] leading-5 text-white tabular-nums">
          音なし {formatDuration(time.current)} / {formatDuration(time.total)}
        </span>
      )}
    </div>
  );
}

function ImageView({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-surface-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- Rails から配信する任意の画像のため next/image の最適化は使わない */}
      <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

// 1件分の中身（形式ごとに振り分ける）
function MaterialBody({ material, firstPageOnly = false }: { material: Material; firstPageOnly?: boolean }) {
  const url = material.file_url;
  const name = material.file_name;
  if (!material.file_attached || !url) return <PreviewMessage>添付ファイルはありません</PreviewMessage>;

  const ext = fileExtension(name);
  const category = fileCategory(name);
  const size = material.file_size ?? 0;
  const tooLarge = (limit: number) => size > limit;

  if (category === 'image') {
    if (ext === 'heic' || ext === 'heif') {
      return <InfoCard material={material} note="HEIC はブラウザで表示できないため、開いて確認してください" />;
    }
    return <ImageView url={url} alt={name ?? material.title} />;
  }
  if (category === 'video') return <VideoLoop url={url} />;
  if (category === 'audio') return <AudioInfo material={material} url={url} />;
  if (ext === 'pdf') {
    if (tooLarge(MAX_BINARY)) return <InfoCard material={material} note="大きいファイルのため中身は表示していません" />;
    return <PdfSlides url={url} width={WIDTH} height={BODY_HEIGHT} firstPageOnly={firstPageOnly} />;
  }
  if (OFFICE_EXTENSIONS.includes(ext)) {
    if (tooLarge(MAX_BINARY)) return <InfoCard material={material} note="大きいファイルのため中身は表示していません" />;
    return <OfficePreview url={url} ext={ext} />;
  }
  if (category === 'archive') return <ZipListPreview url={url} />;
  if (isTextPreviewable(name) || ext === 'ipynb') {
    if (tooLarge(MAX_TEXT)) return <InfoCard material={material} note="大きいファイルのため中身は表示していません" />;
    return <CodeScroll url={url} ext={ext} />;
  }
  return <InfoCard material={material} note="この形式は中身を表示できません。開いて確認してください" />;
}

// まとめの中身を1件ずつ見せる（写真はそのまま、PDF は1ページ目）
function BundleSlides({ members }: { members: Material[] }) {
  const index = useAutoAdvance(members.length, 1800);
  const current = members[index];
  if (!current) return <PreviewMessage>まとめの中身がありません</PreviewMessage>;
  const visual = ['image', 'video'].includes(fileCategory(current.file_name) ?? '') || fileExtension(current.file_name) === 'pdf';
  return (
    <div className="relative h-full">
      {visual ? (
        <MaterialBody key={current.id} material={current} firstPageOnly />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <TypeIcon type={current.material_type} />
          <p className="line-clamp-2 text-sm font-bold">{current.title}</p>
          {current.file_name && <p className="text-[11px] text-muted">{current.file_name}</p>}
        </div>
      )}
      <span className="absolute bottom-2 left-2 max-w-[60%] truncate rounded-full bg-foreground/75 px-2 text-[11px] leading-5 text-surface">
        {current.title}
      </span>
      <SlideCounter index={index} total={members.length} />
    </div>
  );
}

// 一覧の行にカーソルを合わせたときに浮かぶプレビュー。親側で対象ごとに key を付けて作り直す
export function HoverPreview({ target, folders, rowRect, pointerX }: Props) {
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), DELAY);
    // 一覧をスクロールすると行の位置がずれるため、次にカーソルを合わせるまで隠す
    // （プレビューの中の自動スクロールでは隠さない）
    const hide = (event: Event) => {
      if (event.type === 'scroll' && rootRef.current?.contains(event.target as Node)) return;
      window.clearTimeout(timer);
      setVisible(false);
    };
    window.addEventListener('scroll', hide, true);
    window.addEventListener('wheel', hide, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('wheel', hide);
    };
  }, []);
  if (!visible) return null;

  const height = HEADER_HEIGHT + BODY_HEIGHT;
  // カーソルの右下に出し、はみ出すなら左・上へ
  const left =
    pointerX + 24 + WIDTH <= window.innerWidth - 8 ? pointerX + 24 : Math.max(8, pointerX - 24 - WIDTH);
  const top =
    rowRect.bottom + 6 + height <= window.innerHeight - 8
      ? rowRect.bottom + 6
      : Math.max(8, rowRect.top - 6 - height);

  const material = target.kind === 'material' ? target.material : null;
  const folderId = material ? material.folder_id : target.kind === 'bundle' ? target.members[0]?.folder_id ?? null : null;
  const color = folderColor(folderId !== null ? folders.get(folderId)?.color : undefined);
  const title = material ? material.title : target.kind === 'bundle' ? target.bundle.name : '';
  const ext = material ? fileExtension(material.file_name) : '';
  const meta = material
    ? [
        material.file_name,
        fileCategory(material.file_name) === 'code' ? languageName(material.file_name) : null,
        material.file_size ? formatFileSize(material.file_size) : null,
      ]
        .filter(Boolean)
        .join('　')
    : target.kind === 'bundle'
      ? `まとめ　${target.members.length}件`
      : '';

  return (
    <div
      ref={rootRef}
      role="tooltip"
      aria-label={`${title} のプレビュー`}
      className="pointer-events-none fixed z-[70] overflow-hidden rounded-md border border-border bg-surface shadow-2xl"
      style={{ left, top, width: WIDTH, boxShadow: `inset 0 3px 0 ${color}, 0 18px 40px rgb(0 0 0 / 0.25)` }}
    >
      <div className="flex flex-col justify-center border-b border-border px-3 pt-1" style={{ height: HEADER_HEIGHT }}>
        <p className="truncate text-[13px] font-bold">{title}</p>
        <p className="truncate text-[11px] text-muted">{meta || ext.toUpperCase()}</p>
      </div>
      <div style={{ height: BODY_HEIGHT }}>
        {target.kind === 'material' ? (
          <MaterialBody material={target.material} />
        ) : (
          <BundleSlides members={sortBundleMembers(target.members)} />
        )}
      </div>
    </div>
  );
}
