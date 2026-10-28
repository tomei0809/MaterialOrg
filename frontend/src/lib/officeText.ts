// Word・PowerPoint・Excel（と OpenDocument）から、プレビュー用に文字だけを取り出す。
// 図・書式・レイアウトは扱わない

import { listZip, readZipText } from './zip';

export type OfficeContent =
  // スライドごとの段落（pptx・odp）
  | { kind: 'slides'; slides: string[][] }
  // 本文の段落（docx・odt）
  | { kind: 'paragraphs'; paragraphs: string[] }
  // 最初のシートの表（xlsx・ods）
  | { kind: 'table'; rows: string[][] };

export const OFFICE_EXTENSIONS = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'];

const MAX_ROWS = 20;
const MAX_COLS = 8;

function parseXml(text: string) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

// 名前空間の接頭辞を気にせず、要素名（ローカル名）で探す
const byName = (root: Document | Element, name: string) =>
  [...root.getElementsByTagNameNS('*', name)];

// 段落ごとの文字（段落の中の文字片 w:t・a:t をつなぐ）
function paragraphs(root: Document | Element, paragraphTag: string, textTag: string) {
  return byName(root, paragraphTag)
    .map((p) => byName(p, textTag).map((t) => t.textContent ?? '').join(''))
    .map((text) => text.trim())
    .filter(Boolean);
}

// "AB12" → 列番号（0 始まり）
function columnIndex(ref: string) {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  return [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
}

const naturalNumber = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);

export async function extractOfficeContent(buffer: ArrayBuffer, ext: string): Promise<OfficeContent> {
  const entries = listZip(buffer);
  const text = (name: string) => readZipText(buffer, entries, name);

  if (ext === 'pptx') {
    const names = entries
      .map((e) => e.name)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => naturalNumber(a) - naturalNumber(b));
    const slides: string[][] = [];
    for (const name of names) {
      const xml = await text(name);
      slides.push(xml ? paragraphs(parseXml(xml), 'p', 't') : []);
    }
    return { kind: 'slides', slides };
  }

  if (ext === 'docx') {
    const xml = await text('word/document.xml');
    return { kind: 'paragraphs', paragraphs: xml ? paragraphs(parseXml(xml), 'p', 't') : [] };
  }

  if (ext === 'xlsx') {
    const shared = await text('xl/sharedStrings.xml');
    const strings = shared
      ? byName(parseXml(shared), 'si').map((si) => byName(si, 't').map((t) => t.textContent ?? '').join(''))
      : [];
    const sheetName =
      entries
        .map((e) => e.name)
        .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
        .sort((a, b) => naturalNumber(a) - naturalNumber(b))[0] ?? '';
    const sheet = await text(sheetName);
    const rows: string[][] = [];
    if (sheet) {
      for (const row of byName(parseXml(sheet), 'row').slice(0, MAX_ROWS)) {
        const cells: string[] = [];
        for (const cell of byName(row, 'c')) {
          const col = columnIndex(cell.getAttribute('r') ?? '');
          if (col >= MAX_COLS) continue;
          const type = cell.getAttribute('t');
          const value = byName(cell, 'v')[0]?.textContent ?? byName(cell, 't')[0]?.textContent ?? '';
          cells[col] = type === 's' ? (strings[Number(value)] ?? '') : value;
        }
        rows.push(Array.from({ length: Math.max(cells.length, 1) }, (_, i) => cells[i] ?? ''));
      }
    }
    return { kind: 'table', rows };
  }

  // OpenDocument：content.xml に本文がある
  const content = await text('content.xml');
  const doc = content ? parseXml(content) : null;
  if (ext === 'odp' && doc) {
    const slides = byName(doc, 'page').map((page) =>
      byName(page, 'p').map((p) => (p.textContent ?? '').trim()).filter(Boolean),
    );
    return { kind: 'slides', slides };
  }
  if (ext === 'ods' && doc) {
    const table = byName(doc, 'table')[0];
    const rows = table
      ? byName(table, 'table-row')
          .slice(0, MAX_ROWS)
          .map((row) =>
            byName(row, 'table-cell')
              .slice(0, MAX_COLS)
              .map((cell) => (cell.textContent ?? '').trim()),
          )
      : [];
    return { kind: 'table', rows };
  }
  return {
    kind: 'paragraphs',
    paragraphs: doc ? byName(doc, 'p').map((p) => (p.textContent ?? '').trim()).filter(Boolean) : [],
  };
}

// --- ビューア用：見出し・箇条書き・表・ノート・全シートまで取り出す ---

export type DocBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'item'; text: string }
  | { kind: 'table'; rows: string[][] };

export type OfficeDocument =
  | { kind: 'slides'; slides: { paragraphs: string[]; notes: string[] }[] }
  | { kind: 'document'; blocks: DocBlock[] }
  | { kind: 'sheets'; sheets: { name: string; rows: string[][] }[] };

const SHEET_ROWS = 500;
const SHEET_COLS = 50;

const directChildren = (el: Element, name: string) =>
  [...el.children].filter((c) => c.localName === name);

const textOf = (el: Element, tag: string) => byName(el, tag).map((t) => t.textContent ?? '').join('');

// Word の段落の見出しレベル（Heading1・見出し 1・Title など。見出しでなければ 0）
function wordHeadingLevel(p: Element) {
  const style = byName(p, 'pStyle')[0];
  const value = style?.getAttribute('w:val') ?? style?.getAttribute('val') ?? '';
  if (/^title$/i.test(value)) return 1;
  const match = value.match(/(?:heading|見出し)\s*(\d)/i);
  return match ? Math.min(Number(match[1]), 4) : 0;
}

function wordBlocks(doc: Document): DocBlock[] {
  const body = byName(doc, 'body')[0];
  if (!body) return [];
  const blocks: DocBlock[] = [];
  for (const child of [...body.children]) {
    if (child.localName === 'p') {
      const value = textOf(child, 't').trim();
      if (!value) continue;
      const level = wordHeadingLevel(child);
      if (level) blocks.push({ kind: 'heading', level, text: value });
      else if (byName(child, 'numPr').length > 0) blocks.push({ kind: 'item', text: value });
      else blocks.push({ kind: 'paragraph', text: value });
    } else if (child.localName === 'tbl') {
      const rows = directChildren(child, 'tr').map((tr) =>
        directChildren(tr, 'tc').map((tc) => textOf(tc, 't').trim()),
      );
      if (rows.length > 0) blocks.push({ kind: 'table', rows });
    }
  }
  return blocks;
}

// Excel のシートを2次元の表にする（列は A1 形式の位置に合わせる）
function sheetRows(xml: Document, strings: string[]) {
  const rows: string[][] = [];
  for (const row of byName(xml, 'row')) {
    const r = Number(row.getAttribute('r') ?? rows.length + 1) - 1;
    if (r >= SHEET_ROWS) break;
    const cells: string[] = [];
    for (const cell of byName(row, 'c')) {
      const col = columnIndex(cell.getAttribute('r') ?? '');
      if (col >= SHEET_COLS) continue;
      const type = cell.getAttribute('t');
      const value = byName(cell, 'v')[0]?.textContent ?? '';
      if (type === 's') cells[col] = strings[Number(value)] ?? '';
      else if (type === 'inlineStr') cells[col] = textOf(cell, 't');
      else if (type === 'b') cells[col] = value === '1' ? 'TRUE' : 'FALSE';
      else cells[col] = value;
    }
    rows[r] = Array.from({ length: cells.length }, (_, i) => cells[i] ?? '');
  }
  return Array.from({ length: rows.length }, (_, i) => rows[i] ?? []);
}

// xl/_rels/workbook.xml.rels：関連付けID → シートのファイル
function relationTargets(xml: string | null) {
  const map = new Map<string, string>();
  if (!xml) return map;
  for (const rel of byName(parseXml(xml), 'Relationship')) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) map.set(id, target.replace(/^\/?xl\//, ''));
  }
  return map;
}

export async function extractOfficeDocument(buffer: ArrayBuffer, ext: string): Promise<OfficeDocument> {
  const entries = listZip(buffer);
  const text = (name: string) => readZipText(buffer, entries, name);
  const names = entries.map((e) => e.name);

  if (ext === 'pptx') {
    const slideNames = names
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => naturalNumber(a) - naturalNumber(b));
    const slides = [];
    for (const name of slideNames) {
      const xml = await text(name);
      // ノートはスライドの関連付け（_rels）から探す（番号がスライドと同じとは限らないため）
      const rels = await text(name.replace('slides/', 'slides/_rels/') + '.rels');
      const notesTarget = rels?.match(/notesSlides\/(notesSlide\d+\.xml)/)?.[1];
      const notesXml = notesTarget ? await text(`ppt/notesSlides/${notesTarget}`) : null;
      slides.push({
        paragraphs: xml ? paragraphs(parseXml(xml), 'p', 't') : [],
        // ノートにはスライド番号の欄も入るため、数字だけの段落は除く
        notes: notesXml ? paragraphs(parseXml(notesXml), 'p', 't').filter((t) => !/^\d+$/.test(t)) : [],
      });
    }
    return { kind: 'slides', slides };
  }

  if (ext === 'docx') {
    const xml = await text('word/document.xml');
    return { kind: 'document', blocks: xml ? wordBlocks(parseXml(xml)) : [] };
  }

  if (ext === 'xlsx') {
    const shared = await text('xl/sharedStrings.xml');
    const strings = shared ? byName(parseXml(shared), 'si').map((si) => textOf(si, 't')) : [];
    const workbook = await text('xl/workbook.xml');
    const targets = relationTargets(await text('xl/_rels/workbook.xml.rels'));
    const sheetDefs = workbook
      ? byName(parseXml(workbook), 'sheet').map((s, i) => ({
          name: s.getAttribute('name') ?? `Sheet${i + 1}`,
          path: `xl/${targets.get(s.getAttribute('r:id') ?? '') ?? `worksheets/sheet${i + 1}.xml`}`,
        }))
      : names
          .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
          .sort((a, b) => naturalNumber(a) - naturalNumber(b))
          .map((path, i) => ({ name: `Sheet${i + 1}`, path }));
    const sheets = [];
    for (const def of sheetDefs) {
      const xml = await text(def.path);
      sheets.push({ name: def.name, rows: xml ? sheetRows(parseXml(xml), strings) : [] });
    }
    return { kind: 'sheets', sheets };
  }

  // OpenDocument：content.xml に本文がある
  const content = await text('content.xml');
  const doc = content ? parseXml(content) : null;
  if (!doc) return { kind: 'document', blocks: [] };
  if (ext === 'odp') {
    return {
      kind: 'slides',
      slides: byName(doc, 'page').map((page) => ({
        paragraphs: byName(page, 'p').map((p) => (p.textContent ?? '').trim()).filter(Boolean),
        notes: [],
      })),
    };
  }
  if (ext === 'ods') {
    return {
      kind: 'sheets',
      sheets: byName(doc, 'table').map((table, i) => ({
        name: table.getAttribute('table:name') ?? `Sheet${i + 1}`,
        rows: byName(table, 'table-row')
          .slice(0, SHEET_ROWS)
          .map((row) =>
            byName(row, 'table-cell')
              .slice(0, SHEET_COLS)
              .map((cell) => (cell.textContent ?? '').trim()),
          ),
      })),
    };
  }
  const blocks: DocBlock[] = [];
  for (const el of [...doc.getElementsByTagNameNS('*', '*')]) {
    if (el.localName === 'h') {
      const value = (el.textContent ?? '').trim();
      if (value) {
        blocks.push({ kind: 'heading', level: Number(el.getAttribute('text:outline-level') ?? 1), text: value });
      }
    } else if (el.localName === 'p') {
      const value = (el.textContent ?? '').trim();
      if (!value) continue;
      const inList = el.parentElement?.localName === 'list-item';
      blocks.push(inList ? { kind: 'item', text: value } : { kind: 'paragraph', text: value });
    }
  }
  return { kind: 'document', blocks };
}
