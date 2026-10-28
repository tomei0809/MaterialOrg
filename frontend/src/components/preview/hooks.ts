'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribeMedia(query: string) {
  return (listener: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  };
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// 動きを減らす設定のときは、自動スクロール・自動送りをやめる
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

// マウスで操作する端末だけ、カーソルを合わせたときのプレビューを出す
export const useCanHover = () => useMediaQuery('(hover: hover) and (pointer: fine)');

// count 件を interval ごとに順に送る（動きを減らす設定のときは先頭のまま）
export function useAutoAdvance(count: number, interval: number) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (reduced || count <= 1) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearInterval(timer);
  }, [count, interval, reduced]);
  return count > 0 ? index % count : 0;
}

export type Loaded<T> = { status: 'loading' } | { status: 'done'; value: T } | { status: 'error' };

// 非同期の読み込み結果（key が変わったら読み直す）
export function useLoaded<T>(key: string, load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ key: string; loaded: Loaded<T> }>({
    key,
    loaded: { status: 'loading' },
  });
  useEffect(() => {
    let active = true;
    load().then(
      (value) => active && setState({ key, loaded: { status: 'done', value } }),
      () => active && setState({ key, loaded: { status: 'error' } }),
    );
    return () => {
      active = false;
    };
    // load は key ごとに同じ内容を読むため、key だけを見て読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.loaded : { status: 'loading' };
}
