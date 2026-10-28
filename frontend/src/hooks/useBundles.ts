'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchBundles } from '@/lib/materialsApi';
import type { Bundle } from '@/types/material';

export function useBundles() {
  const [bundles, setBundles] = useState<Bundle[]>([]);

  // まとめの取得に失敗しても教材一覧は使えるよう、エラーは握りつぶす
  const reload = useCallback(async () => {
    try {
      setBundles(await fetchBundles());
    } catch {
      // 直前の一覧を表示したままにする
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchBundles()
      .then((data) => {
        if (active) setBundles(data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return { bundles, reload };
}
