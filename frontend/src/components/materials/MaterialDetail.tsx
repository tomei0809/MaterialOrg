import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { FavoriteButton } from '@/components/ui/FavoriteStar';
import { FileBadge } from '@/components/ui/FileBadge';
import { FolderDot } from '@/components/ui/FolderDot';
import { TagChip } from '@/components/ui/TagChip';
import { TypeBadge } from '@/components/ui/TypeBadge';
import { formatDateTime, formatFileSize } from '@/lib/format';
import type { Bundle, Folder, Material } from '@/types/material';
import { FilePreview } from './FilePreview';

type Props = {
  material: Material;
  // 最上位から所属フォルダまでの道筋（未分類なら空）
  folderPath: Folder[];
  // 入っているまとめ（なければ undefined）
  bundle: Bundle | undefined;
  onRemoveFromBundle: (material: Material) => void;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
  onTagClick: (tag: string) => void;
  onToggleFavorite: (material: Material) => void;
  // 添付ファイルを画面全体のビューアで開く
  onOpenViewer: (material: Material) => void;
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

// 右パネルに表示する教材の詳細
export function MaterialDetail({
  material,
  folderPath,
  bundle,
  onRemoveFromBundle,
  onEdit,
  onDelete,
  onTagClick,
  onToggleFavorite,
  onOpenViewer,
}: Props) {
  const folder = folderPath.at(-1);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          <TypeBadge type={material.material_type} />
          <FavoriteButton
            favorite={Boolean(material.favorited_at)}
            title={material.title}
            onToggle={() => onToggleFavorite(material)}
            className="p-1"
          />
        </div>
        <h3 className="mt-2 text-lg leading-snug font-bold">{material.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
          <FolderDot color={folder?.color ?? null} />
          {folder ? folderPath.map((f) => f.name).join(' › ') : '未分類'}
        </p>

        {material.file_attached && material.file_url && (
          <div className="mt-4 flex items-stretch overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              onClick={() => onOpenViewer(material)}
              title="画面全体で開く（一覧では行のダブルクリック・Space キー）"
              className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left hover:bg-primary-soft"
            >
              <FileBadge fileName={material.file_name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {material.file_name ?? 'ファイルを開く'}
                </span>
                {material.file_size != null && (
                  <span className="text-xs text-muted">{formatFileSize(material.file_size)}</span>
                )}
              </span>
              <span className="text-xs text-primary">開く</span>
            </button>
            <a
              href={material.file_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="ブラウザの新しいタブで開く"
              title="ブラウザの新しいタブで開く"
              className="flex items-center border-l border-border px-3 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
            >
              ↗
            </a>
          </div>
        )}

        <div className="mt-3">
          <FilePreview key={material.id} material={material} />
          {material.file_attached && material.file_url && (
            <button
              type="button"
              onClick={() => onOpenViewer(material)}
              className="mt-1.5 text-xs text-primary hover:underline"
            >
              拡大して見る
            </button>
          )}
        </div>

        <dl className="mt-4 divide-y divide-border border-y border-border">
          <Row label="まとめ">
            {bundle ? (
              <span className="flex flex-wrap items-center gap-2">
                <span>{bundle.name}</span>
                <button
                  type="button"
                  onClick={() => onRemoveFromBundle(material)}
                  className="rounded px-1.5 text-xs text-primary hover:bg-primary-soft"
                >
                  まとめから外す
                </button>
              </span>
            ) : (
              <span className="text-muted">なし</span>
            )}
          </Row>
          <Row label="タグ">
            {material.tags.length > 0 ? (
              <span className="flex flex-wrap gap-1.5">
                {material.tags.map((tag) => (
                  <TagChip key={tag} name={tag} onClick={() => onTagClick(tag)} />
                ))}
              </span>
            ) : (
              <span className="text-muted">なし</span>
            )}
          </Row>
          <Row label="説明">
            <span className="whitespace-pre-wrap">
              {material.description?.trim() || <span className="text-muted">なし</span>}
            </span>
          </Row>
          {!material.file_attached && (
            <Row label="ファイル">
              <span className="text-muted">添付なし</span>
            </Row>
          )}
          <Row label="登録日時">{formatDateTime(material.created_at)}</Row>
          <Row label="更新日時">{formatDateTime(material.updated_at)}</Row>
        </dl>
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface px-5 py-3">
        <Button variant="danger" onClick={() => onDelete(material)}>
          削除
        </Button>
        <Button onClick={() => onEdit(material)} className="flex-1">
          編集する
        </Button>
      </div>
    </div>
  );
}
