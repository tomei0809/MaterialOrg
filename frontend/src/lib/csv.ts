// 簡易な CSV の読み取り（引用符の中のカンマ・改行・"" に対応）

export function parseCsv(text: string, maxRows = 20, maxCols = 8) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row.slice(0, maxCols));
      row = [];
      cell = '';
    } else cell += ch;
  }
  if ((cell || row.length) && rows.length < maxRows) rows.push([...row, cell].slice(0, maxCols));
  return rows;
}
