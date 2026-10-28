'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchFolders } from '@/lib/materialsApi';
import type { Folder } from '@/types/material';

export function useFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);

  // フォルダ一覧の取得に失敗しても教材一覧は使えるよう、エラーは握りつぶす
  const reload = useCallback(async () => {
    try {
      setFolders(await fetchFolders());
    } catch {
      // 直前の一覧を表示したままにする
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetchFolders()
      .then((data) => {
        if (active) setFolders(data);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return { folders, reload };
}
