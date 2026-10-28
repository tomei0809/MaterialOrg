import { FolderOptions } from '@/components/folders/FolderOptions';
import { Button } from '@/components/ui/Button';
import { compareBundleNames } from '@/lib/bundles';
import type { FolderIndex } from '@/lib/folderTree';
import type { Bundle } from '@/types/material';

type Props = {
  count: number;
  folderIndex: FolderIndex;
  bundles: Bundle[];
  // 選択中の教材のうち、まとめに入っているものがあるか
  hasBundled: boolean;
  busy: boolean;
  onMove: (folderId: number | null) => void;
  onBundle: () => void;
  onAddToBundle: (bundleId: number) => void;
  onRemoveFromBundle: () => void;
  onDelete: () => void;
  onClear: () => void;
};

const selectClass =
  'rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground';

// 一覧で教材を選択したときに下部に出る、まとめて操作するバー
export function BulkActionBar({
  count,
  folderIndex,
  bundles,
  hasBundled,
  busy,
  onMove,
  onBundle,
  onAddToBundle,
  onRemoveFromBundle,
  onDelete,
  onClear,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border bg-surface px-4 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:px-6">
      <span className="text-sm font-bold">{count}件を選択中</span>

      <Button onClick={onBundle} disabled={busy} className="py-1.5">
        まとめる
      </Button>

      {bundles.length > 0 && (
        <select
          value=""
          disabled={busy}
          aria-label="既存のまとめに追加"
          onChange={(event) => {
            if (event.target.value) onAddToBundle(Number(event.target.value));
          }}
          className={selectClass}
        >
          <option value="">まとめに追加…</option>
          {[...bundles].sort(compareBundleNames).map((bundle) => (
            <option key={bundle.id} value={bundle.id}>
              {bundle.name}（{bundle.materials_count}件）
            </option>
          ))}
        </select>
      )}

      {hasBundled && (
        <Button variant="secondary" onClick={onRemoveFromBundle} disabled={busy} className="py-1.5">
          まとめから外す
        </Button>
      )}

      <select
        value=""
        disabled={busy}
        aria-label="フォルダへ移動"
        onChange={(event) => {
          const value = event.target.value;
          if (value) onMove(value === 'none' ? null : Number(value));
        }}
        className={selectClass}
      >
        <option value="">フォルダへ移動…</option>
        <option value="none">未分類</option>
        <FolderOptions index={folderIndex} />
      </select>

      <div className="ml-auto flex gap-2">
        <Button variant="danger" onClick={onDelete} disabled={busy} className="py-1.5">
          ゴミ箱へ移動
        </Button>
        <Button variant="secondary" onClick={onClear} disabled={busy} className="py-1.5">
          選択を解除
        </Button>
      </div>
    </div>
  );
}
