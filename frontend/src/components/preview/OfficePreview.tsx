'use client';

import { extractOfficeContent } from '@/lib/officeText';
import { cached, fetchBuffer } from '@/lib/previewCache';
import { listZip } from '@/lib/zip';
import { useAutoAdvance, useLoaded } from './hooks';
import { AutoScroll, PreviewMessage, PreviewTable, SlideCounter } from './PreviewParts';

const INTERVAL = 2200;

// PowerPoint のスライドの文字を1枚ずつ見せる
function TextSlides({ slides }: { slides: string[][] }) {
  const index = useAutoAdvance(slides.length, INTERVAL);
  if (slides.length === 0) return <PreviewMessage>スライドがありません</PreviewMessage>;
  const [heading, ...rest] = slides[index];
  return (
    <div className="relative flex h-full items-center justify-center bg-surface-muted p-3">
      {/* スライドの比率（16:9）の白い紙に文字だけを置く */}
      <div className="flex aspect-video max-h-full w-full flex-col gap-1.5 overflow-hidden rounded-sm border border-border bg-surface px-4 py-3 shadow-sm">
        {heading ? (
          <>
            <p className="line-clamp-2 text-sm font-bold">{heading}</p>
            <ul className="space-y-0.5 text-[11px] text-muted">
              {rest.slice(0, 6).map((line, i) => (
                <li key={i} className="truncate">
                  ・{line}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="m-auto text-xs text-muted">（文字のないスライド）</p>
        )}
      </div>
      <SlideCounter index={index} total={slides.length} label="スライド" />
    </div>
  );
}

// Word・PowerPoint・Excel（と OpenDocument）の文字を取り出して見せる
export function OfficePreview({ url, ext }: { url: string; ext: string }) {
  const content = useLoaded(`office:${url}`, () =>
    cached(`office:${url}`, async () => extractOfficeContent(await fetchBuffer(url), ext)),
  );

  if (content.status === 'loading') return <PreviewMessage>文字を取り出しています…</PreviewMessage>;
  if (content.status === 'error') return <PreviewMessage>中身を取り出せませんでした</PreviewMessage>;

  const value = content.value;
  if (value.kind === 'slides') return <TextSlides slides={value.slides} />;
  if (value.kind === 'table') return <PreviewTable rows={value.rows} />;
  if (value.paragraphs.length === 0) return <PreviewMessage>本文の文字がありません</PreviewMessage>;
  return (
    <AutoScroll className="bg-surface px-4 py-3">
      <div className="space-y-1.5 text-xs leading-relaxed">
        {value.paragraphs.slice(0, 200).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </AutoScroll>
  );
}

// ZIP の中のファイル名の一覧
export function ZipListPreview({ url }: { url: string }) {
  const list = useLoaded(`zip:${url}`, () =>
    cached(`zip:${url}`, async () => listZip(await fetchBuffer(url)).filter((e) => !e.name.endsWith('/'))),
  );
  if (list.status === 'loading') return <PreviewMessage>中身を読み込んでいます…</PreviewMessage>;
  if (list.status === 'error') return <PreviewMessage>ZIP の中身を読めませんでした</PreviewMessage>;
  const entries = list.value;
  return (
    <AutoScroll className="px-3 py-2">
      <p className="mb-1 text-[11px] font-bold text-muted">{entries.length}個のファイル</p>
      <ul className="space-y-0.5 font-mono text-[11px]">
        {entries.slice(0, 30).map((e) => (
          <li key={e.name} className="truncate">
            {e.name}
          </li>
        ))}
        {entries.length > 30 && <li className="text-muted">ほか {entries.length - 30} 件</li>}
      </ul>
    </AutoScroll>
  );
}
