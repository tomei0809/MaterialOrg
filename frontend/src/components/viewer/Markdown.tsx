// Markdown を React の要素として描く小さな整形器（HTML 文字列は組み立てないので、中身のタグは実行されない）。
// 対応：見出し・段落・箇条書き・番号付き・引用・コードブロック・表・区切り線・太字・斜体・コード・リンク

import type { ReactNode } from 'react';

// 行内の装飾：`コード`、**太字**、*斜体* / _斜体_、[文字](URL)
function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${i++}`;
    if (match[1]) {
      nodes.push(
        <code key={key} className="rounded bg-surface-muted px-1 font-mono text-[0.92em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (match[2]) {
      nodes.push(<strong key={key}>{inline(token.slice(2, -2), key)}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key}>{inline(token.slice(1, -1), key)}</em>);
    } else {
      const [, label, href] = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) ?? [];
      // 外部のページへのリンクだけを有効にする（javascript: などは文字のまま）
      nodes.push(
        /^https?:\/\//.test(href ?? '') ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {label}
          </a>
        ) : (
          token
        ),
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  const key = () => `b${blocks.length}`;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key()} className="overflow-x-auto rounded-md border border-border bg-surface-muted p-3 font-mono text-[0.85em] leading-relaxed">
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const size = ['text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-base', 'text-sm'][level - 1];
      blocks.push(
        <p key={key()} role="heading" aria-level={level} className={`${size} mt-5 mb-2 font-bold first:mt-0 ${level <= 2 ? 'border-b border-border pb-1' : ''}`}>
          {inline(heading[2], key())}
        </p>,
      );
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={key()} className="my-4 border-border" />);
      i++;
      continue;
    }

    // 表：| a | b | の次に |---|---| が続くもの
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={key()} className="my-3 overflow-x-auto">
          <table className="border-collapse text-[0.92em]">
            <thead>
              <tr>
                {head.map((h, c) => (
                  <th key={c} className="border border-border bg-surface-muted px-2 py-1 text-left font-bold">
                    {inline(h, `${key()}h${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {head.map((_, c) => (
                    <td key={c} className="border border-border px-2 py-1">
                      {inline(row[c] ?? '', `${key()}r${r}c${c}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(
        <blockquote key={key()} className="my-3 border-l-4 border-border pl-3 text-muted">
          <Markdown source={body.join('\n')} />
        </blockquote>,
      );
      continue;
    }

    const list = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key()} className={`my-2 space-y-1 pl-6 ${ordered ? 'list-decimal' : 'list-disc'}`}>
          {items.map((item, n) => (
            <li key={n}>{inline(item.replace(/^\[( |x)\]\s*/i, (m) => (m.includes('x') ? '☑ ' : '☐ ')), `${key()}i${n}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|\s*```|\s*>|\s*([-*+]|\d+[.)])\s)/.test(lines[i])
    ) {
      body.push(lines[i++]);
    }
    blocks.push(
      <p key={key()} className="my-2 leading-relaxed">
        {inline(body.join(' '), key())}
      </p>,
    );
  }

  return <>{blocks}</>;
}
