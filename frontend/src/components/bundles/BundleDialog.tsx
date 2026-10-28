'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { inputClass } from '@/components/ui/FormField';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { sortBundleMembers, suggestBundleName } from '@/lib/bundles';
import {
  assignBundle,
  createBundle,
  deleteBundle,
  renameBundle,
  reorderBundle,
} from '@/lib/materialsApi';
import { MAX_BUNDLE_NAME_LENGTH, type Bundle, type Material } from '@/types/material';

type Props = {
  // 編集するまとめ（null なら選択中・ドロップした教材から新規作成）
  bundle: Bundle | null;
  // 新規作成時はまとめる教材、編集時はまとめの中身
  materials: Material[];
  onClose: () => void;
  onDone: (message: string) => void;
};

const arrowButton =
  'rounded px-1.5 py-0.5 text-xs text-muted hover:bg-surface-muted hover:text-foreground disabled:invisible';

export function BundleDialog({ bundle, materials, onClose, onDone }: Props) {
  // 並び順（ID の配列）。↑↓ で入れ替え、保存時にこの順で並べる
  const [order, setOrder] = useState(() => sortBundleMembers(materials).map((m) => m.id));
  const [name, setName] = useState(
    () => bundle?.name ?? suggestBundleName(sortBundleMembers(materials).map((m) => m.title)),
  );
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());
  const [confirmingUngroup, setConfirmingUngroup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const byId = new Map(materials.map((m) => [m.id, m]));
  const members = order.map((id) => byId.get(id)!).filter(Boolean);
  const initialOrder = sortBundleMembers(materials).map((m) => m.id);
  // 別のまとめから移ってくる教材があれば知らせる
  const movingCount = bundle ? 0 : members.filter((m) => m.bundle_id !== null).length;
  const remaining = order.filter((id) => !removedIds.has(id));
  const orderChanged = remaining.join(',') !== initialOrder.filter((id) => !removedIds.has(id)).join(',');

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    try {
      onDone(await action());
    } catch (err) {
      setError(err instanceof Error ? err.message : '予期しないエラーが発生しました。');
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      if (!bundle) {
        await createBundle(name, order);
        return `${order.length}件を「${name.trim()}」にまとめました。`;
      }
      if (name.trim() !== bundle.name) await renameBundle(bundle.id, name);
      // 外してから、残った中身を並べ替える（並び替えは中身すべての ID が必要なため）
      if (removedIds.size > 0) await assignBundle([...removedIds], null);
      if (orderChanged && remaining.length > 0) await reorderBundle(bundle.id, remaining);
      return removedIds.size > 0
        ? `まとめを更新しました（${removedIds.size}件を外しました）。`
        : 'まとめを更新しました。';
    });
  }

  function handleUngroup() {
    if (!bundle) return;
    void run(async () => {
      await deleteBundle(bundle.id);
      return `「${bundle.name}」を解除しました。中の教材はそのまま残っています。`;
    });
  }

  function toggleRemoved(id: number) {
    setRemovedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function move(index: number, delta: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });
  }

  return (
    <Dialog title={bundle ? 'まとめを編集' : '選択した教材をまとめる'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="bundle-name" className="block text-sm font-bold">
            見出し
          </label>
          <input
            id="bundle-name"
            required
            autoFocus
            maxLength={MAX_BUNDLE_NAME_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onFocus={(event) => event.target.select()}
            placeholder="例：講義資料1～10"
            className={inputClass}
          />
          {!bundle && (
            <p className="text-xs text-muted">
              教材名から候補を入れています。そのまま Enter でまとめられます。
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-bold">
            中身（{remaining.length}件）
            <span className="ml-2 text-xs font-normal text-muted">↑↓ で並び順を変更</span>
          </p>
          <ol className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm">
            {members.map((material, index) => {
              const removed = removedIds.has(material.id);
              return (
                <li key={material.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="w-5 text-right text-xs text-muted tabular-nums">{index + 1}</span>
                  <TypeIcon type={material.material_type} />
                  <span className={`min-w-0 flex-1 truncate ${removed ? 'text-muted line-through' : ''}`}>
                    {material.title}
                  </span>
                  <span className="flex shrink-0">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`「${material.title}」を上へ`}
                      className={arrowButton}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === members.length - 1}
                      aria-label={`「${material.title}」を下へ`}
                      className={arrowButton}
                    >
                      ↓
                    </button>
                  </span>
                  {bundle && (
                    <button
                      type="button"
                      onClick={() => toggleRemoved(material.id)}
                      className="shrink-0 rounded px-2 py-0.5 text-xs text-primary hover:bg-primary-soft"
                    >
                      {removed ? '戻す' : '外す'}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {movingCount > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              うち{movingCount}件は別のまとめから移動します。
            </p>
          )}
          {bundle && remaining.length === 0 && (
            <p className="mt-1.5 text-xs text-danger">
              すべて外すと、このまとめは自動的に解除されます。
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {confirmingUngroup ? (
          <div className="space-y-3 rounded-lg bg-danger-soft p-3 text-sm">
            <p className="text-danger">
              「{bundle?.name}」を解除しますか？中の教材（{members.length}件）は削除されず、一覧に個別に並びます。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmingUngroup(false)} disabled={busy}>
                やめる
              </Button>
              <Button variant="solid-danger" onClick={handleUngroup} disabled={busy}>
                解除する
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            {bundle && (
              <Button variant="danger" onClick={() => setConfirmingUngroup(true)} disabled={busy}>
                まとめを解除
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                キャンセル
              </Button>
              <Button type="submit" disabled={busy}>
                {bundle ? '保存' : 'まとめる'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Dialog>
  );
}
