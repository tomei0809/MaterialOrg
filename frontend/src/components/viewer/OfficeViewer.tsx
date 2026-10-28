'use client';

import { useEffect, useState } from 'react';
import { useLoaded } from '@/components/preview/hooks';
import { extractOfficeDocument, type DocBlock, type OfficeDocument } from '@/lib/officeText';
import { cached, fetchBuffer } from '@/lib/previewCache';
import { GridTable } from './TextViewer';
import { isTyping, ToolGroup, toolButton, ViewerMessage, ViewerToolbar } from './ViewerParts';

function TextOnlyNote() {
  return <span className="text-[11px] text-muted">文字だけを表示しています（図・書式は表示されません）</span>;
}

function SlidesView({ slides }: { slides: Extract<OfficeDocument, { kind: 'slides' }>['slides'] }) {
  const [index, setIndex] = useState(0);
  const go = (n: number) => setIndex(Math.min(slides.length - 1, Math.max(0, n)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event) || event.shiftKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') setIndex((i) => Math.min(slides.length - 1, i + 1));
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') setIndex((i) => Math.max(0, i - 1));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  if (slides.length === 0) return <ViewerMessage>スライドがありません</ViewerMessage>;
  const slide = slides[index];
  const [heading, ...rest] = slide.paragraphs;

  return (
    <>
      <ViewerToolbar>
        <ToolGroup label="スライド">
          <button type="button" className={toolButton} onClick={() => go(index - 1)} disabled={index === 0} aria-label="前のスライド" title="前のスライド（←）">
            ‹
          </button>
          <span className="px-2 text-xs tabular-nums">
            スライド {index + 1} / {slides.length}
          </span>
          <button type="button" className={toolButton} onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="次のスライド" title="次のスライド（→）">
            ›
          </button>
        </ToolGroup>
        <TextOnlyNote />
      </ViewerToolbar>
      <div className="flex h-full">
        <nav aria-label="スライドの一覧" className="hidden w-52 shrink-0 space-y-1 overflow-y-auto border-r border-border bg-surface p-2 md:block">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'page' : undefined}
              className={`flex w-full gap-2 rounded px-2 py-1.5 text-left text-xs ${i === index ? 'bg-primary-soft font-bold' : 'hover:bg-surface-muted'}`}
            >
              <span className="w-5 shrink-0 text-right text-muted tabular-nums">{i + 1}</span>
              <span className="line-clamp-2">{s.paragraphs[0] ?? '（文字なし）'}</span>
            </button>
          ))}
        </nav>
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto bg-surface-muted p-6">
          <div className="flex aspect-video w-full max-w-4xl flex-col gap-4 overflow-auto rounded-sm border border-border bg-surface p-10 shadow-md">
            {heading ? (
              <>
                <p className="text-2xl font-bold">{heading}</p>
                <ul className="space-y-2 text-base">
                  {rest.map((line, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className="text-muted">・</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="m-auto text-sm text-muted">（文字のないスライド）</p>
            )}
          </div>
          {slide.notes.length > 0 && (
            <div className="w-full max-w-4xl rounded-md border border-border bg-surface p-4 text-sm">
              <p className="mb-1 text-xs font-bold text-muted">ノート</p>
              {slide.notes.map((n, i) => (
                <p key={i}>{n}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DocumentView({ blocks }: { blocks: DocBlock[] }) {
  if (blocks.length === 0) return <ViewerMessage>本文の文字がありません</ViewerMessage>;
  const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base'];
  return (
    <>
      <ViewerToolbar>
        <TextOnlyNote />
      </ViewerToolbar>
      <div className="h-full overflow-auto bg-surface-muted py-8">
        <article className="mx-auto max-w-3xl space-y-3 rounded-sm bg-surface px-12 py-10 text-[15px] leading-relaxed shadow-md">
          {blocks.map((block, i) => {
            switch (block.kind) {
              case 'heading':
                return (
                  <p key={i} role="heading" aria-level={block.level} className={`${sizes[block.level - 1] ?? 'text-base'} pt-2 font-bold`}>
                    {block.text}
                  </p>
                );
              case 'item':
                return (
                  <p key={i} className="flex gap-2 pl-4">
                    <span aria-hidden="true">・</span>
                    {block.text}
                  </p>
                );
              case 'table':
                return (
                  <table key={i} className="w-full border-collapse text-sm">
                    <tbody>
                      {block.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((cell, c) => (
                            <td key={c} className={`border border-border px-2 py-1 ${r === 0 ? 'bg-surface-muted font-bold' : ''}`}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              default:
                return <p key={i}>{block.text}</p>;
            }
          })}
        </article>
      </div>
    </>
  );
}

function SheetsView({ sheets }: { sheets: Extract<OfficeDocument, { kind: 'sheets' }>['sheets'] }) {
  const [index, setIndex] = useState(0);
  if (sheets.length === 0) return <ViewerMessage>シートがありません</ViewerMessage>;
  return (
    <>
      <ViewerToolbar>
        <TextOnlyNote />
      </ViewerToolbar>
      <div className="flex h-full flex-col">
        <div className="min-h-0 flex-1">
          {sheets[index].rows.length > 0 ? <GridTable rows={sheets[index].rows} header={false} /> : <ViewerMessage>このシートは空です</ViewerMessage>}
        </div>
        {/* Excel と同じく、シートのタブは下に並べる */}
        <div role="tablist" aria-label="シート" className="flex shrink-0 gap-px overflow-x-auto border-t border-border bg-surface-muted px-2">
          {sheets.map((sheet, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={`border-x border-b border-border px-4 py-1.5 text-xs ${i === index ? '-mt-px bg-surface font-bold' : 'text-muted hover:text-foreground'}`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// Word・PowerPoint・Excel（と OpenDocument）の中身を文字で見せる
export function OfficeViewer({ url, ext }: { url: string; ext: string }) {
  const doc = useLoaded(`officedoc:${url}`, () =>
    cached(`officedoc:${url}`, async () => extractOfficeDocument(await fetchBuffer(url), ext)),
  );
  if (doc.status === 'loading') return <ViewerMessage>中身を取り出しています…</ViewerMessage>;
  if (doc.status === 'error') return <ViewerMessage>中身を取り出せませんでした。「保存」から開いてください。</ViewerMessage>;
  const value = doc.value;
  if (value.kind === 'slides') return <SlidesView slides={value.slides} />;
  if (value.kind === 'sheets') return <SheetsView sheets={value.sheets} />;
  return <DocumentView blocks={value.blocks} />;
}
