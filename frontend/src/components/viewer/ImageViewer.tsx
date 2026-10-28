'use client';

import { useEffect, useRef, useState } from 'react';
import { usePanZoom } from './usePanZoom';
import { isTyping, ToolGroup, toolButton, ViewerToolbar, ZoomControls } from './ViewerParts';

// 写真：拡大・移動・回転（ドラッグ・ホイール・ピンチ・ダブルクリック・キー操作）
export function ImageViewer({ url, alt }: { url: string; alt: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const { view, transform, handlers, zoomAt, fitPage, fitWidth, rotate } = usePanZoom(container, size);

  // R で右回り、Shift+R で左回り
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || event.ctrlKey || event.metaKey) return;
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        rotate(event.shiftKey ? -1 : 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rotate]);

  return (
    <>
      <ViewerToolbar>
        <ZoomControls zoom={view.scale} onZoom={(z) => zoomAt(z)} onFitWidth={fitWidth} onFitPage={fitPage} />
        <ToolGroup label="回転">
          <button type="button" className={toolButton} onClick={() => rotate(-1)} title="左に回転（Shift+R）" aria-label="左に回転">
            ⟲
          </button>
          <button type="button" className={toolButton} onClick={() => rotate(1)} title="右に回転（R）" aria-label="右に回転">
            ⟳
          </button>
        </ToolGroup>
      </ViewerToolbar>
      <div
        ref={container}
        {...handlers}
        className="relative h-full touch-none overflow-hidden bg-[repeating-conic-gradient(var(--surface-muted)_0_25%,var(--surface)_0_50%)] bg-[length:20px_20px] select-none active:cursor-grabbing"
        style={{ cursor: 'grab' }}
      >
        {failed ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            この写真はブラウザで表示できません。「保存」から開いてください。
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- Rails から配信する任意の画像のため next/image の最適化は使わない
          <img
            src={url}
            alt={alt}
            draggable={false}
            onLoad={(e) => setSize({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
            onError={() => setFailed(true)}
            className="absolute top-1/2 left-1/2 max-w-none shadow-lg"
            style={{
              transform,
              visibility: size ? 'visible' : 'hidden',
              // 拡大したときは画素をはっきり見せる
              imageRendering: view.scale >= 3 ? 'pixelated' : 'auto',
            }}
          />
        )}
      </div>
    </>
  );
}
