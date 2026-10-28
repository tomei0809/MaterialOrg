'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { clampZoom, isTyping, nextZoom } from './ViewerParts';

export type View = { scale: number; x: number; y: number; rotation: number };

type Size = { width: number; height: number };

// 写真などの拡大・移動・回転。内容は枠の中央を原点に置き、translate → scale → rotate の順で動かす
// （拡大の中心をカーソル位置に合わせる計算を、回転があっても同じ式で済ませるため）
export function usePanZoom(containerRef: RefObject<HTMLElement | null>, content: Size | null) {
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0, rotation: 0 });
  // 最初に内容の大きさが分かったら全体表示にする
  const fitted = useRef(false);

  const box = () => {
    const el = containerRef.current;
    return el ? { width: el.clientWidth, height: el.clientHeight } : { width: 1, height: 1 };
  };

  const rotatedSize = useCallback(
    (rotation: number) =>
      content
        ? rotation % 180 === 0
          ? content
          : { width: content.height, height: content.width }
        : { width: 1, height: 1 },
    [content],
  );

  const fitScale = useCallback(
    (rotation: number, mode: 'page' | 'width') => {
      const size = rotatedSize(rotation);
      const el = containerRef.current;
      const width = (el?.clientWidth ?? 1) - 32;
      const height = (el?.clientHeight ?? 1) - 32;
      const byWidth = width / size.width;
      // 小さい写真を無理に引き伸ばさない
      return clampZoom(mode === 'width' ? byWidth : Math.min(1, byWidth, height / size.height));
    },
    [containerRef, rotatedSize],
  );

  const fitPage = useCallback(
    () => setView((v) => ({ ...v, scale: fitScale(v.rotation, 'page'), x: 0, y: 0 })),
    [fitScale],
  );
  const fitWidth = useCallback(
    () => setView((v) => ({ ...v, scale: fitScale(v.rotation, 'width'), x: 0, y: 0 })),
    [fitScale],
  );

  useEffect(() => {
    if (!content || fitted.current) return;
    fitted.current = true;
    fitPage();
  }, [content, fitPage]);

  // (px, py) は枠の左上からの位置。そこを中心に拡大率を変える
  const zoomAt = useCallback((scale: number, px?: number, py?: number) => {
    setView((v) => {
      const next = clampZoom(scale);
      const { width, height } = box();
      const cx = (px ?? width / 2) - width / 2;
      const cy = (py ?? height / 2) - height / 2;
      const ratio = next / v.scale;
      return { ...v, scale: next, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
    });
    // box は ref を読むだけなので依存に含めない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotate = useCallback(
    (dir: 1 | -1) =>
      setView((v) => {
        const rotation = (v.rotation + dir * 90 + 360) % 360;
        return { scale: fitScale(rotation, 'page'), x: 0, y: 0, rotation };
      }),
    [fitScale],
  );

  // ホイール：Ctrl（⌘）を押しながらなら拡大縮小、そうでなければ移動。ピンチ操作も Ctrl 付きのホイールとして届く
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0025);
        setView((v) => {
          const next = clampZoom(v.scale * factor);
          const cx = event.clientX - rect.left - rect.width / 2;
          const cy = event.clientY - rect.top - rect.height / 2;
          const ratio = next / v.scale;
          return { ...v, scale: next, x: cx - (cx - v.x) * ratio, y: cy - (cy - v.y) * ratio };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef]);

  // ドラッグで移動、2本指で拡大縮小（タッチ操作）
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const handlers = {
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const last = pointers.current.get(event.pointerId);
      if (!last) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const rect = event.currentTarget.getBoundingClientRect();
        const scale = (pinch.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.distance;
        zoomAt(scale, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      } else if (pointers.current.size === 1) {
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
    },
    onPointerCancel: (event: ReactPointerEvent<HTMLElement>) => {
      pointers.current.delete(event.pointerId);
      pinch.current = null;
    },
    // ダブルクリック：全体表示と実寸（100%）を切り替える
    onDoubleClick: (event: ReactMouseEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const fit = fitScale(view.rotation, 'page');
      if (Math.abs(view.scale - fit) < 0.01) zoomAt(Math.max(1, fit * 2), event.clientX - rect.left, event.clientY - rect.top);
      else fitPage();
    },
  };

  // キー：＋／−／0 で拡大・縮小・全体表示
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '+' || event.key === '=') zoomAt(nextZoom(view.scale, 1));
      else if (event.key === '-') zoomAt(nextZoom(view.scale, -1));
      else if (event.key === '0') fitPage();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view.scale, zoomAt, fitPage]);

  const transform = `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale}) rotate(${view.rotation}deg)`;

  return { view, transform, handlers, zoomAt, fitPage, fitWidth, rotate };
}
