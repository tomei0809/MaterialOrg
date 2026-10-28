'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMaterials } from '@/lib/materialsApi';
import type { Material } from '@/types/material';

// 教材をすべて取得して保持する（絞り込み・並び替えは lib/materialView.ts で行う）
export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 「最近追加」「NEW」の判定基準にする取得時刻
  const [loadedAt, setLoadedAt] = useState(0);

  function apply(request: Promise<Material[]>, isActive = () => true) {
    return request
      .then((data) => {
        if (!isActive()) return;
        setMaterials(data);
        setLoadedAt(Date.now());
        setError('');
      })
      .catch((err: unknown) => {
        if (!isActive()) return;
        setError(
          err instanceof Error ? err.message : '教材一覧を取得できませんでした。',
        );
      })
      .finally(() => {
        if (isActive()) setLoading(false);
      });
  }

  // 登録・更新・削除・移動の後に呼ぶ
  const reload = useCallback(async () => {
    await apply(fetchMaterials());
  }, []);

  // 初回表示時に一覧を取得する
  useEffect(() => {
    let active = true;
    void apply(fetchMaterials(), () => active);
    return () => {
      active = false;
    };
  }, []);

  // お気に入り・開いた日時など、一覧を取り直すほどでない変更を手元だけに反映する
  const patchLocal = useCallback((ids: number[], patch: Partial<Material>) => {
    const targets = new Set(ids);
    setMaterials((current) => current.map((m) => (targets.has(m.id) ? { ...m, ...patch } : m)));
  }, []);

  return { materials, loading, error, loadedAt, reload, patchLocal };
}
