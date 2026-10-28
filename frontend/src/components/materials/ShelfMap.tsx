'use client';

import { useLayoutEffect, useRef, useState, type DragEvent } from 'react';
import { DRAG_TYPE, readDraggedIds } from '@/components/layout/Sidebar';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { folderColor } from '@/lib/folderColors';
import { subtreeIds, type FolderIndex } from '@/lib/folderTree';
import { countByType } from '@/lib/materialView';
import { squarify, type Rect } from '@/lib/treemap';
import {
  MATERIAL_TYPES,
  typeLabels,
  type FolderColor,
  type Material,
  type MaterialType,
} from '@/types/material';

// 区画をクリックしたときの行き先
export type MapTarget =
  | { kind: 'folder'; id: number }
  | { kind: 'unfiled' }
  // 今いるフォルダの直下（移動せず、種類だけで絞り込む）
  | { kind: 'here' }
  // 最上位のフォルダから1つ上（すべての教材）へ戻る
  | { kind: 'all' };

// 区画1つ分（main のフォルダ、またはその中の sub のフォルダ）
type Cell = {
  key: string;
  label: string;
  color: FolderColor | null;
  target: MapTarget;
  counts: Record<MaterialType, number>;
  total: number;
  // 中にあるフォルダの数（孫より下は区画に割らず、数だけ札で出す）
  deeper: number;
  // フォルダの直下の資料（sub の「直下」、フォルダの中の「このフォルダの直下」）
  direct: boolean;
};

// main の区画：中に sub の区画を入れ子で持つ（sub がなければ main だけ）
type Block = Cell & { subs: Cell[] };

type Props = {
  // 検索語・タグで絞った教材（表示範囲と種類の絞り込みは反映しない）
  materials: Material[];
  folderIndex: FolderIndex;
  // 今いるフォルダ（null は「すべて」などのフォルダ外）
  currentFolderId: number | null;
  activeType: MaterialType | 'all';
  onNavigate: (target: MapTarget, type: MaterialType | 'all') => void;
  // 教材を区画へドロップしたとき（folderId が null は未分類）
  onDropToFolder: (ids: number[], folderId: number | null) => void;
};

// sub がないときの高さと、main の中に sub を描くときの高さ
const FLAT_HEIGHT = 156;
const NESTED_HEIGHT = 260;
// main の名前の帯の高さ。区画がこれより小さいときは帯を出さない
const LABEL_HEIGHT = 28;
const GAP = 4;
// main の枠と sub の区画の間
const PAD = 3;
// 割合の棒で、多い順に薄くしていく濃さ（色はフォルダの色1つだけ）
const BAR_OPACITY = [1, 0.62, 0.4, 0.26, 0.16];
// この幅より狭いときは、main を1行ずつ並べる形に切り替える
const BAR_BREAKPOINT = 560;
// スマホ幅の形で並べる main と sub の数（残りは「ほか n」にまとめる）
const ROW_LIMIT = 6;
const ROW_SUB_LIMIT = 4;
// 未分類は「片付け待ち」として斜線を重ねる
const UNFILED_STRIPES =
  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--surface) 22%, transparent) 0 5px, transparent 5px 11px)';
const UNFILED_STRIPES_LIGHT =
  'repeating-linear-gradient(135deg, color-mix(in srgb, var(--muted) 12%, transparent) 0 5px, transparent 5px 11px)';

// 左端の「上の階層へ」の幅
const BACK_WIDTH = 64;

const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, var(--surface))`;

// 件数の多い種類から順に
const typesByCount = (counts: Record<MaterialType, number>) =>
  MATERIAL_TYPES.filter((t) => counts[t] > 0).sort((a, b) => counts[b] - counts[a]);

function FolderGlyph({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`shrink-0 ${className}`} fill="currentColor">
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6a2 2 0 0 1 1.4.6L12 6h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
    </svg>
  );
}

// 今いる場所の中身を区画に分ける：フォルダの外ではトップレベルのフォルダ＋未分類、
// フォルダの中ではサブフォルダ＋「このフォルダの直下」。
// 各フォルダ（main）の中は、その子フォルダ（sub）と「直下」に分ける。孫より下は sub の件数に含めて数だけ出す
export function buildMapBlocks(
  materials: Material[],
  folderIndex: FolderIndex,
  currentFolderId: number | null,
): Block[] {
  const cell = (
    key: string,
    label: string,
    color: FolderColor | null,
    target: MapTarget,
    items: Material[],
    deeper = 0,
    direct = false,
  ): Cell => ({ key, label, color, target, counts: countByType(items), total: items.length, deeper, direct });
  const inFolders = (items: Material[], ids: Set<number>) =>
    items.filter((m) => m.folder_id !== null && ids.has(m.folder_id));
  const byTotal = (a: Cell, b: Cell) => b.total - a.total;

  const blocks: Block[] = [];
  for (const child of folderIndex.children.get(currentFolderId) ?? []) {
    const ids = subtreeIds(folderIndex, child.id);
    const items = inFolders(materials, ids);
    if (items.length === 0) continue;

    const subs: Cell[] = [];
    for (const grandchild of folderIndex.children.get(child.id) ?? []) {
      const subIds = subtreeIds(folderIndex, grandchild.id);
      const subItems = inFolders(items, subIds);
      if (subItems.length > 0) {
        subs.push(
          cell(`folder-${grandchild.id}`, grandchild.name, grandchild.color, { kind: 'folder', id: grandchild.id }, subItems, subIds.size - 1),
        );
      }
    }
    const direct = items.filter((m) => m.folder_id === child.id);
    if (subs.length > 0 && direct.length > 0) {
      subs.push(cell(`direct-${child.id}`, '直下', child.color, { kind: 'folder', id: child.id }, direct, 0, true));
    }
    blocks.push({
      ...cell(`folder-${child.id}`, child.name, child.color, { kind: 'folder', id: child.id }, items, ids.size - 1),
      subs: subs.sort(byTotal),
    });
  }

  if (currentFolderId === null) {
    const items = materials.filter((m) => m.folder_id === null || !folderIndex.byId.has(m.folder_id));
    if (items.length > 0) blocks.push({ ...cell('unfiled', '未分類', null, { kind: 'unfiled' }, items), subs: [] });
  } else {
    const items = materials.filter((m) => m.folder_id === currentFolderId);
    const color = folderIndex.byId.get(currentFolderId)?.color ?? null;
    if (items.length > 0) {
      blocks.push({ ...cell('here', 'このフォルダの直下', color, { kind: 'here' }, items, 0, true), subs: [] });
    }
  }

  return blocks.sort(byTotal);
}

// 一覧の上に置く「資料マップ」：面積＝件数。今いる場所の中で、どのフォルダ（main）の、どのサブフォルダ（sub）に
// どの種類の資料があるかを示す。種類はアイコンと数字、区画の下の棒で割合を見せる。
// 教材を区画へドラッグすると、そのフォルダへ片付けられる
export function ShelfMap({
  materials,
  folderIndex,
  currentFolderId,
  activeType,
  onNavigate,
  onDropToFolder,
}: Props) {
  // 幅は常に外側の要素で測る（中身は幅によって行の形とツリーマップを切り替える）
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // マウスを乗せている区画（main か sub。ほかの main を薄くし、下に内訳を出す）
  const [hovered, setHovered] = useState<string | null>(null);
  // 教材をドラッグして重ねている区画
  const [dropKey, setDropKey] = useState<string | null>(null);

  const blocks = buildMapBlocks(materials, folderIndex, currentFolderId);
  const empty = blocks.length === 0;

  // 区画を並べる部分の幅を測る（空のフォルダとの切り替えで要素が変わるため、そのたびに測り直す）
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [empty]);

  // フォルダの中では、左端に1つ上の階層へ戻る区画を置く（サブフォルダの区画で入ったのと逆の移動）
  const current = currentFolderId !== null ? folderIndex.byId.get(currentFolderId) : undefined;
  const parent =
    current && current.parent_id !== null ? folderIndex.byId.get(current.parent_id) : undefined;
  const back = current
    ? {
        label: parent ? parent.name : 'すべての教材',
        color: parent ? folderColor(parent.color) : 'var(--muted)',
        target: (parent ? { kind: 'folder', id: parent.id } : { kind: 'all' }) as MapTarget,
      }
    : null;
  // compact：スマホ幅の形のときは矢印と名前だけの低い形にする
  const renderBack = (compact: boolean) => back && (
    <button
      type="button"
      onClick={() => onNavigate(back.target, 'all')}
      title={`上の階層「${back.label}」へ戻る（Backspace キー）`}
      aria-label={`上の階層「${back.label}」へ戻る`}
      // 親フォルダへ教材をドロップして移すこともできる（最上位では未分類にはしない）
      onDragOver={(event) => {
        if (!parent || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (dropKey !== 'back') setDropKey('back');
      }}
      onDragLeave={() => setDropKey(null)}
      onDrop={(event) => {
        event.preventDefault();
        setDropKey(null);
        const ids = readDraggedIds(event);
        if (ids && parent) onDropToFolder(ids, parent.id);
      }}
      className={`group flex shrink-0 flex-col items-center justify-center rounded px-1 text-xs font-bold ${
        compact ? 'gap-0.5' : 'gap-1.5'
      } ${
        dropKey === 'back' ? 'outline-3 outline-offset-1 outline-foreground' : ''
      }`}
      style={{
        width: BACK_WIDTH,
        background: `color-mix(in srgb, ${back.color} 18%, var(--surface))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${back.color} 55%, transparent)`,
        color: 'var(--foreground)',
      }}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-full text-white transition-transform group-hover:-translate-y-0.5 ${
          compact ? 'size-4' : 'size-7'
        }`}
        style={{ background: back.color }}
      >
        <svg viewBox="0 0 16 16" className="size-4">
          <path d="M8 13V3.5M3.5 8 8 3.5 12.5 8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </span>
      {!compact && <span className="text-[10px] font-normal text-muted">上の階層へ</span>}
      <span
        className={`w-full text-center leading-tight break-all ${compact ? 'truncate text-[10px]' : 'line-clamp-2'}`}
      >
        {back.label}
      </span>
    </button>
  );

  if (empty) {
    // 空のフォルダ：教材をドラッグして入れられることを示す
    return (
      <div className="flex gap-[3px]">
      {back && <div className="flex h-16">{renderBack(true)}</div>}
      <div
        ref={ref}
        onDragOver={(event) => {
          if (currentFolderId === null || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
          event.preventDefault();
          setDropKey('empty');
        }}
        onDragLeave={() => setDropKey(null)}
        onDrop={(event) => {
          event.preventDefault();
          setDropKey(null);
          const ids = readDraggedIds(event);
          if (ids && currentFolderId !== null) onDropToFolder(ids, currentFolderId);
        }}
        className={`flex h-16 min-w-0 flex-1 items-center justify-center rounded-md border border-dashed px-3 text-center text-sm text-muted ${
          dropKey === 'empty' ? 'border-primary bg-primary-soft' : 'border-border'
        }`}
      >
        このフォルダはまだ空です。教材をここへドラッグするか、ファイルをドロップして登録できます
      </div>
      </div>
    );
  }

  const isHere = (c: Cell) => c.target.kind === 'here';
  const isUnfiled = (c: Cell) => c.target.kind === 'unfiled';
  const folderIdOf = (c: Cell) =>
    c.target.kind === 'folder' ? c.target.id : c.target.kind === 'here' ? currentFolderId : null;
  const mainOf = (key: string | null) =>
    key === null ? undefined : blocks.find((b) => b.key === key || b.subs.some((s) => s.key === key));

  const describe = (c: Cell, type?: MaterialType) => {
    const where = isHere(c) ? 'このフォルダの直下' : c.direct ? `「${mainOf(c.key)?.label}」の直下` : `「${c.label}」`;
    const action = isHere(c) ? '絞り込み' : '開く';
    return type
      ? `${where}の${typeLabels[type]} ${c.counts[type]}件（クリックで${action}）`
      : `${where} ${c.total}件（クリックで${action}）`;
  };

  // 区画へのドロップ：教材をそのフォルダ（未分類の区画なら未分類）へ移す。
  // sub の上では sub が受け取り、外側の main には伝えない
  const dropHandlers = (c: Cell) => ({
    onDragOver: (event: DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      if (dropKey !== c.key) setDropKey(c.key);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropKey(null);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDropKey(null);
      const ids = readDraggedIds(event);
      if (ids) onDropToFolder(ids, folderIdOf(c));
    },
  });

  // ほかの main にマウスを乗せているときは薄くする
  const hoveredMain = mainOf(hovered);
  const faded = (b: Block) => hoveredMain !== undefined && hoveredMain.key !== b.key && dropKey === null;
  const dropRing = (c: Cell) =>
    dropKey === c.key ? 'outline-3 -outline-offset-1 outline-foreground' : '';

  const focusKey = dropKey ?? hovered;
  const focused = focusKey
    ? blocks.flatMap((b) => [b, ...b.subs]).find((c) => c.key === focusKey)
    : undefined;
  const caption = focused ? (
    dropKey ? (
      <span className="font-bold text-foreground">
        {isUnfiled(focused) ? '未分類に戻す' : `「${focused.direct ? mainOf(focused.key)?.label : focused.label}」へ移動`}
      </span>
    ) : (
      <>
        <span className="font-bold text-foreground">
          {isHere(focused) ? 'このフォルダの直下' : focused.direct ? `${mainOf(focused.key)?.label} の直下` : focused.label}
        </span>
        <span className="tabular-nums">
          {typesByCount(focused.counts)
            .map((t) => `${typeLabels[t]} ${focused.counts[t]}`)
            .join('、')}
        </span>
        {focused.deeper > 0 && <span>中にフォルダ {focused.deeper}</span>}
        <span>{isHere(focused) ? 'クリックで絞り込み' : 'クリックで開く'}</span>
      </>
    )
  ) : (
    <>
      <span className="hidden sm:inline">
        面積が件数、下の棒が種類の割合です。区画をクリックで開き、教材をドラッグして入れると片付けられます
      </span>
      <span className="sm:hidden">面積＝件数。区画をタップで開きます</span>
    </>
  );

  // 中にあるフォルダの数の札（孫より下は区画に割らずにここへまとめる）
  const deeperChip = (c: Cell) =>
    c.deeper > 0 && (
      <span
        title={`中にフォルダが ${c.deeper} 個あります`}
        className="pointer-events-none absolute right-1 bottom-1 flex items-center gap-0.5 rounded-full border border-border bg-surface px-1.5 text-[10.5px] leading-4 text-muted tabular-nums"
      >
        <FolderGlyph className="size-2.5" />＋{c.deeper}
      </span>
    );

  // 種類の割合の棒（多い順に左から。色はフォルダの色1つで、濃さだけ変える）
  const ratioBar = (c: Cell, color: string, className: string) => (
    <span aria-hidden="true" className={`pointer-events-none flex h-[5px] gap-[1.5px] overflow-hidden rounded-full ${className}`}>
      {typesByCount(c.counts).map((t, i) => (
        <span
          key={t}
          style={{ flexGrow: c.counts[t], flexBasis: 0, background: color, opacity: BAR_OPACITY[i] }}
        />
      ))}
    </span>
  );

  // 区画1つ（sub、または sub を持たない main の中身）。
  // 全体のボタンで開き、種類のアイコンを押すとその種類で絞り込んで開く
  const renderCell = (c: Cell, rect: Rect, options: { showName: boolean; nested: boolean }) => {
    const color = isUnfiled(c) ? 'var(--muted)' : folderColor(c.color);
    const tiny = rect.width < 40 || rect.height < 30;
    const small = rect.width < 96 || rect.height < 56;
    const roomy = rect.width >= 150 && rect.height >= 72;
    const types = typesByCount(c.counts);
    const shown = roomy ? types.slice(0, Math.max(1, Math.floor((rect.width - 16) / 84))) : types.slice(0, 1);
    const showBar = !tiny && rect.height >= 56;

    return (
      <div
        key={c.key}
        onMouseEnter={() => setHovered(c.key)}
        {...(options.nested ? dropHandlers(c) : {})}
        className={`absolute overflow-hidden rounded ${options.nested ? dropRing(c) : ''}`}
        style={{
          left: rect.x,
          top: rect.y,
          width: Math.max(0, rect.width),
          height: Math.max(0, rect.height),
          background: !options.nested ? 'transparent' : c.direct ? tint(color, 6) : 'var(--surface)',
          boxShadow: !options.nested
            ? undefined
            : c.direct
              ? `inset 0 0 0 1px color-mix(in srgb, ${color} 45%, transparent)`
              : `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, var(--border))`,
        }}
      >
        <button
          type="button"
          title={describe(c)}
          aria-label={describe(c)}
          onClick={() => onNavigate(c.target, 'all')}
          className="absolute inset-0 hover:outline-2 hover:-outline-offset-2 hover:outline-foreground"
          style={c.direct && options.nested ? { border: `1px dashed color-mix(in srgb, ${color} 60%, transparent)`, borderRadius: 4 } : undefined}
        />
        {!tiny && (
          <div className={`pointer-events-none relative flex flex-col ${small ? 'gap-1 p-1.5' : 'gap-1.5 px-2.5 py-2'}`}>
            {options.showName && (
              <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
                <span className={`truncate font-bold ${small ? 'text-xs' : 'text-[13px]'}`}>{c.label}</span>
                <span className="shrink-0 text-[11px] text-muted tabular-nums">{c.total}</span>
              </span>
            )}
            {!options.showName && isUnfiled(c) && roomy && (
              <span className="text-xs text-muted">どのフォルダにも入っていない資料</span>
            )}
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {shown.map((t) => (
                <button
                  key={t}
                  type="button"
                  title={describe(c, t)}
                  aria-label={describe(c, t)}
                  aria-pressed={activeType === t && isHere(c)}
                  onClick={() => onNavigate(c.target, t)}
                  className={`pointer-events-auto flex items-center gap-1 rounded text-foreground hover:underline ${
                    activeType !== 'all' && activeType !== t ? 'opacity-40' : ''
                  }`}
                >
                  <TypeIcon type={t} variant="plain" size={small ? 'size-4' : 'size-5'} />
                  <span className={`font-bold tabular-nums ${small ? 'text-xs' : 'text-sm'}`}>{c.counts[t]}</span>
                  {roomy && <span className="text-[11px] text-muted">{typeLabels[t]}</span>}
                </button>
              ))}
            </span>
          </div>
        )}
        {showBar &&
          ratioBar(c, color, `absolute bottom-2 ${small ? 'left-1.5' : 'left-2.5'} ${c.deeper > 0 ? 'right-12' : small ? 'right-1.5' : 'right-2.5'}`)}
        {!tiny && deeperChip(c)}
      </div>
    );
  };

  // スマホ幅：main を1行ずつ、その中の sub を横に並べる
  const renderRows = () => (
    <div className="flex flex-col gap-2.5">
      {blocks.slice(0, ROW_LIMIT).map((b) => {
        const color = isUnfiled(b) ? 'var(--muted)' : folderColor(b.color);
        const items = b.subs.length > 0 ? b.subs : [b];
        const rest = items.slice(ROW_SUB_LIMIT).reduce((sum, s) => sum + s.total, 0);
        return (
          <div key={b.key} {...dropHandlers(b)} className={`rounded ${dropRing(b)}`}>
            <button
              type="button"
              title={describe(b)}
              onClick={() => onNavigate(b.target, 'all')}
              className="flex max-w-full items-center gap-1.5 text-[13px] font-bold"
              style={{ color: isUnfiled(b) ? 'var(--foreground)' : color }}
            >
              {!isUnfiled(b) && !isHere(b) && <FolderGlyph />}
              <span className="truncate">{isUnfiled(b) ? '未分類（片付け待ち）' : b.label}</span>
              <span className="shrink-0 text-[11px] font-normal text-muted tabular-nums">{b.total}件</span>
            </button>
            <div className="mt-1 flex h-12 gap-[3px]">
              {items.slice(0, ROW_SUB_LIMIT).map((s) => {
                const subColor = isUnfiled(s) ? 'var(--muted)' : folderColor(s.color);
                const top = typesByCount(s.counts)[0];
                return (
                  <button
                    key={s.key}
                    type="button"
                    title={describe(s)}
                    aria-label={describe(s)}
                    onClick={() => onNavigate(s.target, 'all')}
                    {...(s === b ? {} : dropHandlers(s))}
                    className={`relative flex min-w-0 flex-col items-start overflow-hidden rounded px-1.5 py-1 text-left ${dropRing(s)}`}
                    style={{
                      flexGrow: s.total,
                      flexBasis: 0,
                      minWidth: 44,
                      background: isUnfiled(s) ? tint('var(--muted)', 10) : s.direct ? tint(subColor, 6) : 'var(--surface)',
                      backgroundImage: isUnfiled(s) ? UNFILED_STRIPES_LIGHT : undefined,
                      boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${subColor} 35%, var(--border))`,
                    }}
                  >
                    {s === b ? (
                      // サブフォルダがない main：種類ごとの件数を並べる
                      <span className="flex h-full flex-wrap items-center gap-x-3 text-xs font-bold tabular-nums">
                        {typesByCount(s.counts).map((t) => (
                          <span key={t} className="flex items-center gap-1">
                            <TypeIcon type={t} variant="plain" size="size-4" />
                            {s.counts[t]}
                            <span className="text-[10.5px] font-normal text-muted">{typeLabels[t]}</span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <>
                        <span className="w-full truncate text-[11px] font-bold">{s.label}</span>
                        <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
                          {top && <TypeIcon type={top} variant="plain" size="size-4" />}
                          {s.total}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: subColor }} />
                  </button>
                );
              })}
              {rest > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate(b.target, 'all')}
                  className="flex shrink-0 items-center rounded px-2 text-[11px] text-muted"
                  style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }}
                >
                  ほか {rest}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {blocks.length > ROW_LIMIT && (
        <p className="text-[11px] text-muted">ほか {blocks.length - ROW_LIMIT} フォルダはサイドバーから開けます</p>
      )}
    </div>
  );

  const innerWidth = Math.max(0, width);
  // 狭い画面では main を1行ずつ並べる（左端の「上の階層へ」の幅も含めて判定する）
  const isRows = width > 0 && width + (back ? BACK_WIDTH : 0) < BAR_BREAKPOINT;
  const nested = blocks.some((b) => b.subs.length > 0);
  const height = nested ? NESTED_HEIGHT : FLAT_HEIGHT;
  const cells =
    innerWidth > 0
      ? squarify(
          blocks.map((b) => ({ value: b.total, data: b })),
          { x: 0, y: 0, width: innerWidth + GAP, height: height + GAP },
        )
      : [];

  const treemap = (
    <div className="relative w-full" style={{ height }} onMouseLeave={() => setHovered(null)}>
      {cells.map((cell) => {
        const b = cell.data;
        const color = isUnfiled(b) ? 'var(--muted)' : folderColor(b.color);
        const here = isHere(b);
        const unfiled = isUnfiled(b);
        // 右と下に GAP ずつ余白を取って区画の間をあける（外枠の幅に合わせるため全体を GAP 分広げて割り付けている）
        const outer = { width: cell.width - GAP, height: cell.height - GAP };
        const showLabel = outer.width >= 44 && outer.height >= LABEL_HEIGHT + 22;
        const bodyTop = showLabel ? LABEL_HEIGHT : 0;
        const body: Rect = {
          x: PAD,
          y: bodyTop + PAD,
          width: outer.width - PAD * 2,
          height: outer.height - bodyTop - PAD * 2,
        };
        // sub を描けるだけの広さがあるときだけ入れ子にする
        const showSubs = b.subs.length > 0 && body.width >= 60 && body.height >= 40;
        const subCells = showSubs
          ? squarify(
              b.subs.map((s) => ({ value: s.total, data: s })),
              { ...body, width: body.width + PAD, height: body.height + PAD },
            )
          : [];

        return (
          <div
            key={b.key}
            onMouseEnter={() => setHovered(b.key)}
            {...dropHandlers(b)}
            className={`absolute overflow-hidden rounded-md transition-opacity duration-150 ${dropRing(b)}`}
            style={{
              left: cell.x,
              top: cell.y,
              width: Math.max(0, outer.width),
              height: Math.max(0, outer.height),
              opacity: faded(b) ? 0.45 : 1,
              background: unfiled ? tint('var(--muted)', 10) : tint(color, here ? 6 : 9),
              backgroundImage: unfiled ? UNFILED_STRIPES_LIGHT : undefined,
              boxShadow: `inset 0 0 0 1.5px ${unfiled ? 'var(--border)' : here ? `color-mix(in srgb, ${color} 45%, transparent)` : color}`,
            }}
          >
            {showLabel && (
              <button
                type="button"
                title={describe(b)}
                onClick={() => onNavigate(b.target, 'all')}
                onMouseEnter={() => setHovered(b.key)}
                className={`absolute inset-x-0 top-0 flex items-center gap-1.5 overflow-hidden px-2.5 text-left whitespace-nowrap ${
                  here ? 'text-foreground' : 'text-white'
                }`}
                style={{
                  height: LABEL_HEIGHT,
                  // 直下の区画は「今いる場所」なので地の色を薄くして、サブフォルダと区別する
                  background: here ? tint(color, 22) : color,
                  backgroundImage: unfiled ? UNFILED_STRIPES : undefined,
                }}
              >
                {!here && !unfiled && <FolderGlyph />}
                {outer.width >= 84 && <span className="truncate text-sm font-bold">{b.label}</span>}
                <span className="shrink-0 text-xs tabular-nums opacity-90">{b.total}件</span>
                {unfiled && outer.width >= 230 && (
                  <span className="ml-auto truncate text-[11px]">ドラッグしてフォルダへ片付け</span>
                )}
              </button>
            )}

            {showSubs
              ? subCells.map((s) =>
                  renderCell(
                    s.data,
                    { x: s.x, y: s.y, width: s.width - PAD, height: s.height - PAD },
                    { showName: true, nested: true },
                  ),
                )
              : renderCell(b, showLabel ? body : { x: 0, y: 0, width: outer.width, height: outer.height }, {
                  showName: !showLabel,
                  nested: false,
                })}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full">
      <div className="flex gap-[3px]">
        {renderBack(isRows)}
        <div ref={ref} className="min-w-0 flex-1">
          {isRows ? renderRows() : treemap}
        </div>
      </div>
      {/* 下の1行：マウスを乗せた区画の内訳（なければ使い方） */}
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <p aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-x-2">
          {caption}
        </p>
      </div>
    </div>
  );
}
