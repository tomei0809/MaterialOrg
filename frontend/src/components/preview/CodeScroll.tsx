'use client';

import { codeOutline } from '@/lib/codeOutline';
import { parseCsv } from '@/lib/csv';
import { fetchText } from '@/lib/previewCache';
import { useLoaded } from './hooks';
import { AutoScroll, PreviewMessage, PreviewTable } from './PreviewParts';

// プレビューに流す行数の上限（長いファイルは先頭から）
const MAX_LINES = 400;

const outlineMarks = { f: 'ƒ', c: 'C', h: '#' } as const;

// Jupyter Notebook をセルごとの見出し付きテキストにする
function notebookText(json: string) {
  const notebook = JSON.parse(json) as { cells?: { cell_type: string; source: string[] | string }[] };
  return (notebook.cells ?? [])
    .map((cell) => {
      const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
      return `${cell.cell_type === 'code' ? '# [コード]' : '# [説明]'}\n${source.trim()}`;
    })
    .join('\n\n');
}

type Props = { url: string; ext: string };

// コード・テキストを行番号付きで先頭から自動スクロールし、右に関数・クラスの構成を出す
export function CodeScroll({ url, ext }: Props) {
  const text = useLoaded(`text:${url}`, () => fetchText(url));

  if (text.status === 'loading') return <PreviewMessage>読み込んでいます…</PreviewMessage>;
  if (text.status === 'error') return <PreviewMessage>中身を表示できませんでした</PreviewMessage>;

  if (ext === 'csv') return <PreviewTable rows={parseCsv(text.value)} />;

  let body = text.value;
  let outlineExt = ext;
  if (ext === 'ipynb') {
    try {
      body = notebookText(text.value);
      outlineExt = 'py';
    } catch {
      return <PreviewMessage>ノートブックを読み取れませんでした</PreviewMessage>;
    }
  }

  const lines = body.split(/\r?\n/);
  const shown = lines.slice(0, MAX_LINES);
  const outline = codeOutline(body, outlineExt);

  return (
    <div className="flex h-full">
      <AutoScroll className="min-w-0 flex-1 bg-surface-muted py-1.5">
        <pre className="font-mono text-[11px] leading-[1.55]">
          <code className="grid grid-cols-[auto_1fr]">
            {shown.map((line, i) => (
              <span key={i} className="contents">
                <span className="pr-2 pl-2 text-right text-muted/70 select-none tabular-nums">{i + 1}</span>
                <span className={`pr-2 whitespace-pre ${line.startsWith('# [') && ext === 'ipynb' ? 'font-bold' : ''}`}>
                  {line || ' '}
                </span>
              </span>
            ))}
          </code>
          {lines.length > MAX_LINES && (
            <p className="px-2 pt-1 text-muted">…（全{lines.length}行）</p>
          )}
        </pre>
      </AutoScroll>
      {outline.length > 0 && (
        <aside className="w-32 shrink-0 overflow-hidden border-l border-border px-2 py-1.5 text-[11px]">
          <p className="mb-1 font-bold text-muted">構成</p>
          <ul className="space-y-0.5">
            {outline.map((item) => (
              <li key={`${item.line}-${item.name}`} className="flex items-baseline gap-1" title={`${item.line}行目`}>
                <span className="w-2.5 shrink-0 text-center font-bold text-muted">{outlineMarks[item.kind]}</span>
                <span className="truncate">{item.name}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
