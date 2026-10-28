'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { folderColor } from '@/lib/folderColors';
import { folderPath, type FolderIndex } from '@/lib/folderTree';
import { formatDate } from '@/lib/format';
import { fetchTrash, purgeMaterials, restoreMaterials } from '@/lib/materialsApi';
import type { Material } from '@/types/material';

type Props = {
  folderIndex: FolderIndex;
  onClose: () => void;
  // 元に戻した・完全に削除したあと（一覧とゴミ箱の件数を読み直す）
  onChanged: (message: string) => Promise<void> | void;
  onError: (err: unknown) => void;
};

const DAY = 24 * 60 * 60 * 1000;

// 完全に削除されるまでの日数（当日中なら「今日」）
function daysLeft(purgeAt: string | null | undefined, now: number) {
  if (!purgeAt) return null;
  return Math.max(0, Math.ceil((new Date(purgeAt).getTime() - now) / DAY));
}

// ゴミ箱：削除した教材を元に戻す・完全に削除する。30日を過ぎたものは自動で完全に削除される
export function TrashDialog({ folderIndex, onClose, onChanged, onError }: Props) {
  const [items, setItems] = useState<Material[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    fetchTrash()
      .then((list) => !cancelled && setItems(list))
      .catch((err) => {
        if (!cancelled) {
          setItems([]);
          onError(err);
        }
      });
    return () => {
      cancelled = true;
    };
    // 開いたときに1回だけ読み込む（onError は親の描画ごとに作り直されるため依存に入れない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = items ?? [];
  const allSelected = list.length > 0 && list.every((m) => selected.has(m.id));
  const targets = list.filter((m) => selected.has(m.id));

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(action: () => Promise<string>) {
    setBusy(true);
    try {
      const message = await action();
      const ids = new Set(targets.map((m) => m.id));
      setItems((current) => (current ?? []).filter((m) => !ids.has(m.id)));
      setSelected(new Set());
      await onChanged(message);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  }

  const restore = () =>
    run(async () => {
      const { restored } = await restoreMaterials(targets.map((m) => m.id));
      return `${restored}件を元に戻しました。`;
    });

  const purge = () => {
    const message =
      targets.length === 1
        ? `「${targets[0].title}」を完全に削除しますか？\n添付ファイルも消え、元に戻せません。`
        : `選択した${targets.length}件を完全に削除しますか？\n添付ファイルも消え、元に戻せません。`;
    if (!window.confirm(message)) return;
    void run(async () => {
      const { purged } = await purgeMaterials(targets.map((m) => m.id));
      return `${purged}件を完全に削除しました。`;
    });
  };

  const empty = () => {
    if (!window.confirm(`ゴミ箱の${list.length}件をすべて完全に削除しますか？\n添付ファイルも消え、元に戻せません。`)) return;
    setBusy(true);
    purgeMaterials('all')
      .then(async ({ purged }) => {
        setItems([]);
        setSelected(new Set());
        await onChanged(`ゴミ箱を空にしました（${purged}件）。`);
      })
      .catch(onError)
      .finally(() => setBusy(false));
  };

  return (
    <Dialog title="ゴミ箱" onClose={onClose} wide>
      <p className="-mt-2 mb-3 text-xs text-muted">
        削除した教材は30日間ここに残り、元のフォルダへ戻せます。30日を過ぎると添付ファイルごと自動で完全に削除されます。
      </p>

      {items === null ? (
        <p className="py-10 text-center text-sm text-muted">読み込んでいます…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted">
          ゴミ箱は空です。削除した教材は30日間ここに残ります
        </p>
      ) : (
        <>
          <label className="mb-1 flex items-center gap-2 px-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(list.map((m) => m.id)))}
            />
            すべて選択（{list.length}件）
          </label>
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {list.map((material) => {
              const path = material.folder_id !== null ? folderPath(folderIndex, material.folder_id) : [];
              const folder = path.at(-1);
              const left = daysLeft(material.purge_at, now);
              return (
                <li key={material.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={selected.has(material.id)}
                      onChange={() => toggle(material.id)}
                      aria-label={`「${material.title}」を選択`}
                    />
                    <TypeIcon type={material.material_type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{material.title}</span>
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: folderColor(folder?.color) }}
                        />
                        <span className="truncate">
                          {path.length > 0 ? path.map((f) => f.name).join(' › ') : '未分類'}
                        </span>
                        {material.file_name && <span className="truncate">・{material.file_name}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted tabular-nums">
                      {material.deleted_at && <span className="block">{formatDate(material.deleted_at)} に削除</span>}
                      {left !== null && (
                        <span className={`block ${left <= 3 ? 'font-bold text-danger' : ''}`}>
                          {left === 0 ? '今日中に完全に削除' : `あと${left}日で完全に削除`}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => void restore()} disabled={busy || targets.length === 0}>
          元に戻す{targets.length > 0 ? `（${targets.length}件）` : ''}
        </Button>
        <Button variant="danger" onClick={purge} disabled={busy || targets.length === 0}>
          完全に削除…
        </Button>
        <Button
          variant="secondary"
          onClick={empty}
          disabled={busy || list.length === 0}
          className="ml-auto"
        >
          ゴミ箱を空にする…
        </Button>
      </div>
    </Dialog>
  );
}
