'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useLoaded } from '@/components/preview/hooks';
import { openPdf, pdfPageSizes, renderPdfPageAt } from '@/lib/pdfPreview';
import { clampZoom, isTyping, nextZoom, ToolGroup, toolButton, ViewerMessage, ViewerToolbar, ZoomControls } from './ViewerParts';

const PAGE_GAP = 16;
const THUMB_WIDTH = 104;

type Size = { width: number; height: number };

// 1ページ分。画面に近づいたら描き、拡大率が変わったら少し待って描き直す（その間は古い絵を伸ばして見せる）
function PdfPage({
  doc,
  page,
  scale,
  size,
  root,
}: {
  doc: PDFDocumentProxy;
  page: number;
  scale: number;
  size: Size;
  root: HTMLElement | null;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      root,
      rootMargin: '800px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const timer = window.setTimeout(() => {
      renderPdfPageAt(doc, page, scale).then(
        (canvas) => {
          if (!active || !holder.current) return;
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          holder.current.replaceChildren(canvas);
        },
        () => {},
      );
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [doc, page, scale, visible]);

  return (
    <div
      ref={holder}
      data-page={page}
      className="mx-auto bg-white shadow-md [&>canvas]:block"
      style={{ width: size.width * scale, height: size.height * scale }}
    />
  );
}

function Thumbnail({ doc, page, size, active, onSelect }: { doc: PDFDocumentProxy; page: number; size: Size; active: boolean; onSelect: () => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const scale = THUMB_WIDTH / size.width;
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let done = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || done) return;
      done = true;
      renderPdfPageAt(doc, page, scale).then(
        (canvas) => {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          holder.current?.replaceChildren(canvas);
        },
        () => {},
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [doc, page, scale]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${page}ページ目へ`}
      aria-current={active ? 'page' : undefined}
      className={`block w-full rounded p-1.5 text-center text-[11px] ${active ? 'bg-primary-soft font-bold' : 'hover:bg-surface-muted'}`}
    >
      <div
        ref={holder}
        className={`mx-auto bg-white ${active ? 'outline-2 outline-primary' : 'outline outline-border'}`}
        style={{ width: THUMB_WIDTH, height: size.height * scale }}
      />
      <span className="mt-1 block tabular-nums">{page}</span>
    </button>
  );
}

function PdfDocumentView({ doc, sizes }: { doc: PDFDocumentProxy; sizes: Size[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [thumbs, setThumbs] = useState(true);
  // 拡大率を変えたあと、カーソル（または中央）の下にあった位置を保つためのスクロール補正
  // （x, y は内容の中での位置、px, py は枠の中での位置）
  const anchor = useRef<{ x: number; y: number; px: number; py: number; ratio: number } | null>(null);
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  const fittedOnce = useRef(false);

  const maxWidth = Math.max(...sizes.map((s) => s.width));
  const fitWidthScale = useCallback(() => {
    const width = (scroller.current?.clientWidth ?? 800) - 48;
    return clampZoom(width / maxWidth);
  }, [maxWidth]);
  const fitPageScale = useCallback(() => {
    const el = scroller.current;
    const first = sizes[0];
    if (!el || !first) return 1;
    return clampZoom(Math.min((el.clientWidth - 48) / first.width, (el.clientHeight - 32) / first.height));
  }, [sizes]);

  // 開いたときは幅に合わせる（大きすぎる場合は 150% まで）
  useLayoutEffect(() => {
    if (fittedOnce.current || !scroller.current) return;
    fittedOnce.current = true;
    setScale(Math.min(1.5, fitWidthScale()));
  }, [fitWidthScale]);

  const zoomTo = useCallback((next: number, point?: { x: number; y: number }) => {
    const el = scroller.current;
    const value = clampZoom(next);
    if (el) {
      const px = point?.x ?? el.clientWidth / 2;
      const py = point?.y ?? el.clientHeight / 2;
      anchor.current = { x: el.scrollLeft + px, y: el.scrollTop + py, px, py, ratio: value / scaleRef.current };
    }
    setScale(value);
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.x * a.ratio - a.px;
    el.scrollTop = a.y * a.ratio - a.py;
    anchor.current = null;
  }, [scale]);

  // 各ページの上端の位置（ページ番号の追従と移動に使う）
  const offsets: number[] = [];
  let top = PAGE_GAP;
  for (const s of sizes) {
    offsets.push(top);
    top += s.height * scale + PAGE_GAP;
  }

  const goTo = useCallback(
    (n: number) => {
      const target = Math.min(sizes.length, Math.max(1, n));
      scroller.current?.scrollTo({ top: offsets[target - 1] - PAGE_GAP / 2 });
      setPage(target);
      setPageInput(String(target));
    },
    // offsets は scale と sizes から決まる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sizes, scale],
  );

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const probe = el.scrollTop + el.clientHeight / 3;
    let current = 1;
    for (let i = 0; i < offsets.length; i++) if (offsets[i] <= probe) current = i + 1;
    if (current !== page) {
      setPage(current);
      setPageInput(String(current));
    }
  };

  // Ctrl（⌘）＋ホイール・ピンチで拡大縮小（ブラウザ全体の拡大は止める）
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomTo(scaleRef.current * Math.exp(-event.deltaY * 0.0025), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomTo]);

  // キー：←→・PageUp/PageDown でページ、＋／−／0 で拡大
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') goTo(page + 1);
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') goTo(page - 1);
      else if (event.key === '+' || event.key === '=') zoomTo(nextZoom(scale, 1));
      else if (event.key === '-') zoomTo(nextZoom(scale, -1));
      else if (event.key === '0') setScale(fitPageScale());
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, page, scale, zoomTo, fitPageScale]);

  // ドラッグで移動（手のひらツール）
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  return (
    <>
      <ViewerToolbar>
        <ToolGroup label="ページ">
          <button type="button" className={toolButton} onClick={() => setThumbs((v) => !v)} aria-pressed={thumbs} title="ページの一覧">
            ▤
          </button>
          <button type="button" className={toolButton} onClick={() => goTo(page - 1)} disabled={page <= 1} aria-label="前のページ" title="前のページ（←）">
            ‹
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              goTo(Number(pageInput) || page);
            }}
            className="flex items-center gap-1 px-1 text-xs tabular-nums"
          >
            <input
              aria-label="ページ番号"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
              onBlur={() => setPageInput(String(page))}
              className="w-9 rounded border border-border bg-surface px-1 py-0.5 text-center"
            />
            <span className="text-muted">/ {sizes.length}</span>
          </form>
          <button type="button" className={toolButton} onClick={() => goTo(page + 1)} disabled={page >= sizes.length} aria-label="次のページ" title="次のページ（→）">
            ›
          </button>
        </ToolGroup>
        <ZoomControls
          zoom={scale}
          onZoom={(z) => zoomTo(z)}
          onFitWidth={() => setScale(fitWidthScale())}
          onFitPage={() => setScale(fitPageScale())}
        />
      </ViewerToolbar>
      <div className="flex h-full">
        {thumbs && (
          <nav aria-label="ページの一覧" className="hidden w-36 shrink-0 space-y-1 overflow-y-auto border-r border-border bg-surface p-2 md:block">
            {sizes.map((s, i) => (
              <Thumbnail key={i} doc={doc} page={i + 1} size={s} active={page === i + 1} onSelect={() => goTo(i + 1)} />
            ))}
          </nav>
        )}
        <div
          ref={(el) => {
            scroller.current = el;
            if (el !== root) setRoot(el);
          }}
          onScroll={onScroll}
          onPointerDown={(event) => {
            if (event.button !== 0 || !scroller.current) return;
            drag.current = { x: event.clientX, y: event.clientY, left: scroller.current.scrollLeft, top: scroller.current.scrollTop };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const d = drag.current;
            if (!d || !scroller.current) return;
            scroller.current.scrollLeft = d.left - (event.clientX - d.x);
            scroller.current.scrollTop = d.top - (event.clientY - d.y);
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          className="min-w-0 flex-1 cursor-grab overflow-auto bg-surface-muted select-none active:cursor-grabbing"
          data-testid="pdf-scroller"
        >
          <div className="flex min-w-fit flex-col items-center px-6" style={{ gap: PAGE_GAP, paddingTop: PAGE_GAP, paddingBottom: PAGE_GAP }}>
            {sizes.map((s, i) => (
              <PdfPage key={i} doc={doc} page={i + 1} scale={scale} size={s} root={root} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// PDF：縦に並べたページを拡大・移動しながら読む
export function PdfViewer({ url }: { url: string }) {
  const loaded = useLoaded(`pdfdoc:${url}`, async () => {
    const doc = await openPdf(url);
    return { doc, sizes: await pdfPageSizes(doc) };
  });
  if (loaded.status === 'loading') return <ViewerMessage>PDF を読み込んでいます…</ViewerMessage>;
  if (loaded.status === 'error') return <ViewerMessage>この PDF は表示できませんでした。「保存」から開いてください。</ViewerMessage>;
  return <PdfDocumentView doc={loaded.value.doc} sizes={loaded.value.sizes} />;
}
