'use client';

import { useEffect, useRef } from 'react';
import { openPdf, renderPdfPage } from '@/lib/pdfPreview';
import { cached } from '@/lib/previewCache';
import { useAutoAdvance, useLoaded } from './hooks';
import { PreviewMessage, SlideCounter } from './PreviewParts';

// スライドショーで見せるページ数の上限（長い PDF は先頭から）
const MAX_PAGES = 20;
const INTERVAL = 1800;

type Props = {
  url: string;
  width: number;
  height: number;
  // まとめのスライドショーの中では1ページ目だけを見せる
  firstPageOnly?: boolean;
};

// PDF を1ページ目→2ページ目…と自動で送って見せる
export function PdfSlides({ url, width, height, firstPageOnly = false }: Props) {
  const doc = useLoaded(`pdf:${url}`, () => openPdf(url));
  const pageCount = doc.status === 'done' ? Math.min(doc.value.numPages, MAX_PAGES) : 0;
  const index = useAutoAdvance(firstPageOnly ? 1 : pageCount, INTERVAL);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (doc.status !== 'done') return;
    let active = true;
    const pdf = doc.value;
    const draw = (page: number) =>
      cached(`pdfpage:${url}:${page}:${width}x${height}`, () => renderPdfPage(pdf, page, width, height));

    draw(index + 1).then((canvas) => {
      if (!active || !holder.current) return;
      holder.current.replaceChildren(canvas);
      // 次のページを先に描いておき、切り替えを滑らかにする
      if (!firstPageOnly && pageCount > 1) void draw(((index + 1) % pageCount) + 1).catch(() => {});
    }, () => {});
    return () => {
      active = false;
    };
  }, [doc, index, url, width, height, pageCount, firstPageOnly]);

  if (doc.status === 'loading') return <PreviewMessage>PDF を読み込んでいます…</PreviewMessage>;
  if (doc.status === 'error') return <PreviewMessage>PDF を表示できませんでした</PreviewMessage>;

  return (
    <div className="relative flex h-full items-center justify-center bg-surface-muted">
      <div ref={holder} className="flex items-center justify-center shadow-sm [&>canvas]:bg-white" />
      {!firstPageOnly && pageCount > 1 && (
        <SlideCounter
          index={index}
          total={pageCount}
          label={doc.value.numPages > MAX_PAGES ? `全${doc.value.numPages}ページ中` : undefined}
        />
      )}
    </div>
  );
}
