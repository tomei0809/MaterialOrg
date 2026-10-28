'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLoaded } from '@/components/preview/hooks';
import { codeOutline } from '@/lib/codeOutline';
import { parseCsv } from '@/lib/csv';
import { fetchText } from '@/lib/previewCache';
import { Markdown } from './Markdown';
import { ToolGroup, toolButton, ViewerMessage, ViewerToolbar } from './ViewerParts';

// 一度に描く行数の上限（それ以上は「保存」から開いてもらう）
const MAX_LINES = 20000;
const CSV_ROWS = 2000;
const CSV_COLS = 60;

type Match = { line: number; start: number };

// 検索語に当たる部分を強調する
function highlight(line: string, query: string, lineIndex: number, current: Match | null) {
  if (!query) return line || ' ';
  const lower = line.toLowerCase();
  const q = query.toLowerCase();
  const parts: ReactNode[] = [];
  let at = 0;
  let found = lower.indexOf(q);
  while (found >= 0) {
    if (found > at) parts.push(line.slice(at, found));
    const active = current?.line === lineIndex && current.start === found;
    parts.push(
      <mark key={found} data-active={active || undefined} className={active ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-foreground'}>
        {line.slice(found, found + q.length)}
      </mark>,
    );
    at = found + q.length;
    found = lower.indexOf(q, at);
  }
  if (at < line.length) parts.push(line.slice(at));
  return parts.length > 0 ? parts : ' ';
}

function CodeView({ text, ext }: { text: string; ext: string }) {
  const lines = useMemo(() => text.replace(/\r\n?/g, '\n').split('\n'), [text]);
  const shown = lines.slice(0, MAX_LINES);
  const outline = useMemo(() => codeOutline(text, ext), [text, ext]);
  const [fontSize, setFontSize] = useState(13);
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [flashLine, setFlashLine] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const matches = useMemo<Match[]>(() => {
    if (!query) return [];
    const q = query.toLowerCase();
    const found: Match[] = [];
    shown.forEach((line, n) => {
      const lower = line.toLowerCase();
      for (let at = lower.indexOf(q); at >= 0 && found.length < 5000; at = lower.indexOf(q, at + q.length)) {
        found.push({ line: n, start: at });
      }
    });
    return found;
  }, [query, shown]);
  const current = matches.length > 0 ? matches[Math.min(matchIndex, matches.length - 1)] : null;

  const scrollToLine = (line: number) => {
    scroller.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: 'center' });
  };

  useEffect(() => {
    if (current) scrollToLine(current.line);
  }, [current]);

  // Ctrl+F でビューアの中の検索欄を開く（ブラウザのページ内検索の代わり）
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInput.current?.select(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <ViewerToolbar>
        <ToolGroup label="文字の大きさ">
          <button type="button" className={toolButton} onClick={() => setFontSize((s) => Math.max(10, s - 1))} aria-label="文字を小さく">
            A−
          </button>
          <span className="w-8 text-center text-xs tabular-nums">{fontSize}</span>
          <button type="button" className={toolButton} onClick={() => setFontSize((s) => Math.min(24, s + 1))} aria-label="文字を大きく">
            A＋
          </button>
        </ToolGroup>
        <ToolGroup label="表示">
          <button type="button" className={toolButton} aria-pressed={wrap} onClick={() => setWrap((v) => !v)} title="長い行を折り返す">
            折り返し
          </button>
          <button
            type="button"
            className={toolButton}
            aria-pressed={searchOpen}
            onClick={() => {
              setSearchOpen((v) => !v);
              window.setTimeout(() => searchInput.current?.select(), 0);
            }}
            title="検索（Ctrl+F）"
          >
            検索
          </button>
          <button
            type="button"
            className={toolButton}
            onClick={() => {
              void navigator.clipboard?.writeText(text).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'コピーしました' : 'すべてコピー'}
          </button>
        </ToolGroup>
        <span className="text-xs text-muted tabular-nums">{lines.length.toLocaleString()}行</span>
      </ViewerToolbar>

      <div className="flex h-full">
        <div className="relative min-w-0 flex-1">
          {searchOpen && (
            <div className="absolute top-2 right-4 z-10 flex items-center gap-1 rounded-md border border-border bg-surface p-1 shadow-lg">
              <input
                ref={searchInput}
                autoFocus
                aria-label="ファイルの中を検索"
                placeholder="ファイルの中を検索"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches.length > 0) {
                    e.preventDefault();
                    setMatchIndex((n) => (n + (e.shiftKey ? -1 : 1) + matches.length) % matches.length);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setSearchOpen(false);
                  }
                }}
                className="w-48 rounded border border-border bg-surface px-2 py-1 text-xs"
              />
              <span className="w-16 text-center text-xs text-muted tabular-nums" aria-live="polite">
                {query ? (matches.length ? `${Math.min(matchIndex, matches.length - 1) + 1} / ${matches.length}` : '0件') : ''}
              </span>
              <button type="button" className={toolButton} onClick={() => setSearchOpen(false)} aria-label="検索を閉じる">
                ✕
              </button>
            </div>
          )}
          <div ref={scroller} className="h-full overflow-auto bg-surface-muted py-3">
            <pre className="font-mono leading-[1.6]" style={{ fontSize }}>
              <code className="grid grid-cols-[auto_1fr]">
                {shown.map((line, n) => (
                  <span key={n} className="contents">
                    <span className="sticky left-0 bg-surface-muted pr-3 pl-4 text-right text-muted/70 select-none tabular-nums">{n + 1}</span>
                    <span
                      data-line={n}
                      className={`pr-4 ${wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre'} ${flashLine === n ? 'bg-primary-soft' : ''}`}
                    >
                      {highlight(line, query, n, current)}
                    </span>
                  </span>
                ))}
              </code>
            </pre>
            {lines.length > MAX_LINES && (
              <p className="px-4 pt-2 text-xs text-muted">先頭の{MAX_LINES.toLocaleString()}行だけを表示しています（全{lines.length.toLocaleString()}行）。</p>
            )}
          </div>
        </div>
        {outline.length > 0 && (
          <nav aria-label="構成" className="hidden w-52 shrink-0 overflow-y-auto border-l border-border bg-surface p-3 text-xs lg:block">
            <p className="mb-2 font-bold text-muted">構成</p>
            <ul className="space-y-0.5">
              {outline.map((item) => (
                <li key={`${item.line}-${item.name}`}>
                  <button
                    type="button"
                    onClick={() => {
                      scrollToLine(item.line - 1);
                      setFlashLine(item.line - 1);
                      window.setTimeout(() => setFlashLine(null), 1200);
                    }}
                    className="flex w-full items-baseline gap-1.5 rounded px-1.5 py-0.5 text-left hover:bg-surface-muted"
                  >
                    <span className="w-3 shrink-0 text-center font-bold text-muted">{{ f: 'ƒ', c: 'C', h: '#' }[item.kind]}</span>
                    <span className="truncate">{item.name}</span>
                    <span className="ml-auto text-[10px] text-muted tabular-nums">{item.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );
}

function MarkdownView({ text }: { text: string }) {
  const [raw, setRaw] = useState(false);
  if (raw) {
    return (
      <>
        <ViewerToolbar>
          <ToolGroup label="表示">
            <button type="button" className={toolButton} onClick={() => setRaw(false)}>
              整形して表示
            </button>
          </ToolGroup>
        </ViewerToolbar>
        <CodeView text={text} ext="md" />
      </>
    );
  }
  return (
    <>
      <ViewerToolbar>
        <ToolGroup label="表示">
          <button type="button" className={toolButton} onClick={() => setRaw(true)}>
            元の文字を表示
          </button>
        </ToolGroup>
      </ViewerToolbar>
      <div className="h-full overflow-auto bg-surface">
        <article className="mx-auto max-w-3xl px-8 py-8 text-[15px]">
          <Markdown source={text} />
        </article>
      </div>
    </>
  );
}

// 見出しの行と行番号を固定した表（CSV・Excel 共通）
export function GridTable({ rows, header = true }: { rows: string[][]; header?: boolean }) {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const columnName = (i: number) => {
    let n = i + 1;
    let name = '';
    while (n > 0) {
      name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
      n = Math.floor((n - 1) / 26);
    }
    return name;
  };
  const [first, ...rest] = header ? rows : [[], ...rows];
  return (
    <div className="h-full overflow-auto bg-surface">
      <table className="border-separate border-spacing-0 text-xs">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="sticky left-0 z-20 border-r border-b border-border bg-surface-muted px-2" />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} className="border-r border-b border-border bg-surface-muted px-2 py-0.5 font-normal text-muted">
                {columnName(c)}
              </th>
            ))}
          </tr>
          {header && (
            <tr>
              <th className="sticky left-0 z-20 border-r border-b border-border bg-surface-muted px-2 text-right font-normal text-muted tabular-nums">1</th>
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className="max-w-64 truncate border-r border-b border-border bg-surface px-2 py-1 text-left font-bold">
                  {first[c] ?? ''}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rest.map((row, r) => (
            <tr key={r} className="hover:bg-surface-muted">
              <td className="sticky left-0 border-r border-b border-border bg-surface-muted px-2 text-right text-muted tabular-nums">
                {r + (header ? 2 : 1)}
              </td>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} title={row[c]} className="max-w-64 truncate border-r border-b border-border px-2 py-1">
                  {row[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type NotebookCell = {
  cell_type: string;
  source: string[] | string;
  execution_count?: number | null;
  outputs?: {
    output_type: string;
    text?: string[] | string;
    data?: Record<string, string[] | string>;
    ename?: string;
    evalue?: string;
  }[];
};

const joinSource = (value: string[] | string | undefined) => (Array.isArray(value) ? value.join('') : (value ?? ''));

function NotebookView({ text }: { text: string }) {
  const cells = useMemo(() => {
    try {
      return (JSON.parse(text) as { cells?: NotebookCell[] }).cells ?? null;
    } catch {
      return null;
    }
  }, [text]);
  if (!cells) return <ViewerMessage>ノートブックを読み取れませんでした</ViewerMessage>;
  return (
    <div className="h-full overflow-auto bg-surface">
      <div className="mx-auto max-w-4xl space-y-3 px-6 py-6">
        {cells.map((cell, i) =>
          cell.cell_type === 'markdown' ? (
            <div key={i} className="px-2 text-[15px]">
              <Markdown source={joinSource(cell.source)} />
            </div>
          ) : (
            <div key={i} className="grid grid-cols-[3.5rem_1fr] gap-2">
              <span className="pt-2 text-right font-mono text-xs text-muted">[{cell.execution_count ?? ' '}]</span>
              <div className="min-w-0 space-y-2">
                <pre className="overflow-x-auto rounded-md border border-border bg-surface-muted p-3 font-mono text-[13px] leading-relaxed">
                  {joinSource(cell.source)}
                </pre>
                {(cell.outputs ?? []).map((out, n) => {
                  const png = out.data?.['image/png'];
                  if (png) {
                    // eslint-disable-next-line @next/next/no-img-element -- ノートブックに埋め込まれた実行結果の画像
                    return <img key={n} alt="実行結果の画像" src={`data:image/png;base64,${joinSource(png).replace(/\s/g, '')}`} className="max-w-full" />;
                  }
                  const body = out.output_type === 'error' ? `${out.ename}: ${out.evalue}` : joinSource(out.text ?? out.data?.['text/plain']);
                  return body ? (
                    <pre key={n} className={`overflow-x-auto px-3 font-mono text-xs leading-relaxed ${out.output_type === 'error' ? 'text-danger' : 'text-muted'}`}>
                      {body}
                    </pre>
                  ) : null;
                })}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

// コード・テキスト・Markdown・CSV・ノートブック
export function TextViewer({ url, ext }: { url: string; ext: string }) {
  const text = useLoaded(`text:${url}`, () => fetchText(url));
  if (text.status === 'loading') return <ViewerMessage>読み込んでいます…</ViewerMessage>;
  if (text.status === 'error') return <ViewerMessage>中身を表示できませんでした。「保存」から開いてください。</ViewerMessage>;
  if (ext === 'md') return <MarkdownView text={text.value} />;
  if (ext === 'csv') return <GridTable rows={parseCsv(text.value, CSV_ROWS, CSV_COLS)} />;
  if (ext === 'ipynb') return <NotebookView text={text.value} />;
  return <CodeView text={text.value} ext={ext} />;
}
