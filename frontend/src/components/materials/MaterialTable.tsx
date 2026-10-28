'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { PreviewTarget } from '@/components/preview/HoverPreview';
import { DRAG_TYPE, readDraggedIds } from '@/components/layout/Sidebar';
import { BundleIcon } from '@/components/ui/BundleIcon';
import { FileBadge } from '@/components/ui/FileBadge';
import { FolderDot } from '@/components/ui/FolderDot';
import { FavoriteButton } from '@/components/ui/FavoriteStar';
import { FolderIcon } from '@/components/ui/FolderIcon';
import { RenameInput } from '@/components/ui/RenameInput';
import { TypeIcon } from '@/components/ui/TypeIcon';
import { folderColor, folderTint } from '@/lib/folderColors';
import type { TableRow } from '@/lib/folderTree';
import { formatDate } from '@/lib/format';
import type { GroupRow as GroupRowData } from '@/lib/grouping';
import { isWithinDays, NEW_DAYS } from '@/lib/materialView';
import {
  MATERIAL_TYPES,
  MAX_FOLDER_NAME_LENGTH,
  type Bundle,
  type Density,
  type Folder,
  type Material,
  type MaterialType,
} from '@/types/material';

type Props = {
  rows: TableRow[];
  folders: Map<number, Folder>;
  // フォルダ列・スマホでの2行目に出す、今いる場所から見たフォルダの道筋
  folderLabel: (folderId: number | null) => string;
  density: Density;
  now: number;
  selectedIds: Set<number>;
  activeId: number | null;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onOpen: (material: Material) => void;
  // ダブルクリックで添付ファイルをビューアで開く
  onOpenViewer: (material: Material) => void;
  onEdit: (material: Material) => void;
  onDelete: (material: Material) => void;
  onTagClick: (tag: string) => void;
  onToggleFavorite: (material: Material) => void;
  onToggleFolder: (id: number) => void;
  onOpenFolder: (id: number) => void;
  onDropToFolder: (ids: number[], folderId: number) => void;
  onToggleBundle: (id: number) => void;
  onEditBundle: (bundle: Bundle) => void;
  onToggleGroup: (key: string) => void;
  // 教材の行に重ねてドロップ：bundle＝まとめる、before/after＝まとめの中で並び替え
  onDropOnMaterial: (ids: number[], target: Material, mode: MaterialDropMode) => void;
  // まとめの行に重ねてドロップ：そのまとめに追加
  onDropIntoBundle: (ids: number[], bundleId: number) => void;
  // フォルダ行の右クリックメニューと、その場での名前の変更
  renamingFolderId: number | null;
  onRename: (folder: Folder, name: string) => void;
  onCancelRename: () => void;
  onFolderContextMenu: (folder: Folder, x: number, y: number) => void;
  // 教材行の右クリックメニューと、その場での教材名の変更
  onMaterialContextMenu: (material: Material, x: number, y: number) => void;
  renamingMaterialId: number | null;
  onRenameMaterial: (material: Material, title: string) => void;
  onCancelRenameMaterial: () => void;
  // まとめ・区切り見出しのチェックで中身をまとめて選択／解除する
  onSelectMany: (ids: number[], selected: boolean) => void;
  // 行にカーソルを合わせたとき（null は行から外れたとき）。添付ファイルのプレビューを出す
  onHoverPreview: (hover: HoverInfo | null) => void;
};

export type HoverInfo = {
  target: PreviewTarget;
  rowRect: { top: number; bottom: number };
  pointerX: number;
};

// 行の <tr> に付けるカーソルの出入りの処理
type HoverHandlers = {
  onMouseEnter: (event: MouseEvent<HTMLTableRowElement>) => void;
  onMouseLeave: () => void;
};

export type MaterialDropMode = 'bundle' | 'before' | 'after';

// ドラッグ中に、どの行へ何をしようとしているか（行の見た目に反映する）
type DropHint = { materialId: number; mode: MaterialDropMode } | { bundleId: number } | null;

const MAX_VISIBLE_TAGS = 2;
// その場で教材名を変えるときの入力の上限
const MAX_TITLE_LENGTH = 200;
// 階層 1 段あたりの字下げ（px）
const INDENT = 22;

// 表の置き場所の幅で表示する列が変わる（Tailwind のコンテナクエリ @xl / @3xl / @5xl）。
// 2列・3列表示では1つの表が狭くなるため、画面幅ではなく表自身の幅で決める
const CONTAINER_BREAKPOINTS = { xl: 576, '3xl': 768, '5xl': 1024 } as const;

// 今の表の幅で見えている列の数。区切り見出しなど横いっぱいの行の colSpan に使う
// （見えていない列の分まで colSpan すると、表の右側に空の列ができて幅が崩れるため）
function useVisibleColumnCount(ref: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState<number>(CONTAINER_BREAKPOINTS['5xl']);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  const at = (bp: keyof typeof CONTAINER_BREAKPOINTS) => (width >= CONTAINER_BREAKPOINTS[bp] ? 1 : 0);
  // チェック・教材名・形式は常に表示。フォルダ(@3xl)・タグ(@5xl)・更新日と操作(@xl)
  return 3 + at('3xl') + at('5xl') + at('xl') * 2;
}

// 閉じたまとめ・区切りの中身も含めた、この行の並びで選択できる教材
// （開いている区切りの中身は自分の行として並ぶため、見出しの分は数えない。
// 2列・3列表示で、見出しの中身が次の列に続くときも、その列の分だけになる）
export function selectableIdsOf(rows: TableRow[]) {
  return new Set(
    rows.flatMap((row) =>
      row.kind === 'material'
        ? [row.material.id]
        : row.kind === 'bundle'
          ? row.members.map((m) => m.id)
          : row.kind === 'group' && row.collapsed
            ? row.ids
            : [],
    ),
  );
}

// 行の左端の色帯（フォルダの色）
const stripe = (color: string, width = 4) => ({ boxShadow: `inset ${width}px 0 0 ${color}` });

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={`size-3 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
    >
      <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function RowCheckbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      className="size-4 accent-primary"
    />
  );
}

export function MaterialTable({
  rows,
  folders,
  folderLabel,
  density,
  now,
  selectedIds,
  activeId,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onOpenViewer,
  onEdit,
  onDelete,
  onTagClick,
  onToggleFavorite,
  onToggleFolder,
  onOpenFolder,
  onDropToFolder,
  onToggleBundle,
  onEditBundle,
  onToggleGroup,
  onDropOnMaterial,
  onDropIntoBundle,
  renamingFolderId,
  onRename,
  onCancelRename,
  onFolderContextMenu,
  onMaterialContextMenu,
  renamingMaterialId,
  onRenameMaterial,
  onCancelRenameMaterial,
  onSelectMany,
  onHoverPreview,
}: Props) {
  const hoverOf = (target: PreviewTarget): HoverHandlers => ({
    onMouseEnter: (event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      onHoverPreview({ target, rowRect: { top: rect.top, bottom: rect.bottom }, pointerX: event.clientX });
    },
    onMouseLeave: () => onHoverPreview(null),
  });
  const [dropFolderId, setDropFolderId] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<DropHint>(null);
  // ドラッグ中の教材ID（dragover 中は dataTransfer の中身を読めないため、ここで覚えておく）
  const draggingIds = useRef<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useVisibleColumnCount(containerRef);
  const cellY = density === 'compact' ? 'py-1' : 'py-2';
  // 閉じたまとめ・区切りの中身も含めた、この一覧で選択できる教材
  const selectableIds = selectableIdsOf(rows);
  const allSelected =
    selectableIds.size > 0 && [...selectableIds].every((id) => selectedIds.has(id));
  const someSelected = !allSelected && [...selectableIds].some((id) => selectedIds.has(id));

  // 選択中の行をドラッグしたら選択中すべて、それ以外はその行（まとめなら中身）だけを渡す
  function handleDragStart(event: DragEvent, ids: number[]) {
    const dragged = ids.some((id) => selectedIds.has(id)) ? [...selectedIds] : ids;
    draggingIds.current = dragged;
    onHoverPreview(null);
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragged));
    event.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    draggingIds.current = [];
    setDropHint(null);
    setDropFolderId(null);
  }

  // 一覧に出ている教材（閉じたまとめの中身も含む）。ドラッグ元がどのまとめにいるかを調べる
  const materialById = new Map<number, Material>();
  for (const row of rows) {
    if (row.kind === 'material') materialById.set(row.material.id, row.material);
    if (row.kind === 'bundle') for (const m of row.members) materialById.set(m.id, m);
  }

  // 教材の行の上：同じまとめの中で1件だけ動かすなら並び替え（行の上半分＝前、下半分＝後ろ）、
  // それ以外は「重ねてまとめる」
  function dragOverMaterial(event: DragEvent, target: Material, inBundle: boolean) {
    const ids = draggingIds.current;
    if (!event.dataTransfer.types.includes(DRAG_TYPE) || ids.length === 0 || ids.includes(target.id)) {
      return;
    }
    // すでに全部が相手のまとめに入っているなら、重ねても何も変わらない（並び替えを除く）
    const allInTargetBundle =
      target.bundle_id !== null && ids.every((id) => materialById.get(id)?.bundle_id === target.bundle_id);
    const source = ids.length === 1 ? materialById.get(ids[0]) : undefined;
    let mode: MaterialDropMode = 'bundle';
    if (inBundle && target.bundle_id !== null && source?.bundle_id === target.bundle_id) {
      const rect = event.currentTarget.getBoundingClientRect();
      mode = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    } else if (allInTargetBundle) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropHint === null || !('materialId' in dropHint) || dropHint.materialId !== target.id || dropHint.mode !== mode) {
      setDropHint({ materialId: target.id, mode });
    }
  }

  function dropOnMaterial(event: DragEvent, target: Material) {
    const ids = draggingIds.current;
    const hint = dropHint;
    handleDragEnd();
    if (!hint || !('materialId' in hint) || hint.materialId !== target.id || ids.length === 0) return;
    event.preventDefault();
    onDropOnMaterial(ids, target, hint.mode);
  }

  // まとめの行の上：そのまとめに追加（すでに全部入っているなら何もしない）
  function dragOverBundle(event: DragEvent, bundle: Bundle, memberIds: number[]) {
    const ids = draggingIds.current;
    if (!event.dataTransfer.types.includes(DRAG_TYPE) || ids.length === 0) return;
    if (ids.every((id) => memberIds.includes(id))) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dropHint === null || !('bundleId' in dropHint) || dropHint.bundleId !== bundle.id) {
      setDropHint({ bundleId: bundle.id });
    }
  }

  function dropOnBundle(event: DragEvent, bundle: Bundle) {
    const ids = draggingIds.current;
    handleDragEnd();
    if (ids.length === 0) return;
    event.preventDefault();
    onDropIntoBundle(ids, bundle.id);
  }

  const materialHint = (id: number) =>
    dropHint && 'materialId' in dropHint && dropHint.materialId === id ? dropHint.mode : null;

  const colorOf = (folderId: number | null) =>
    folderColor(folderId !== null ? folders.get(folderId)?.color : null);

  const th = 'border-b border-border px-3 py-1.5 font-normal';

  return (
    // 列幅を固定し、残りの幅をすべて教材名に使う
    <div ref={containerRef} className="@container">
    <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
      <colgroup>
        <col className="w-10" />
        <col />
        <col className="hidden w-44 @3xl:table-column" />
        <col className="hidden w-44 @5xl:table-column" />
        <col className="w-16" />
        <col className="hidden w-24 @xl:table-column" />
        {/* スマホでは行タップ→詳細パネルから編集・削除できるため操作列を隠す */}
        <col className="hidden w-24 @xl:table-column" />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-surface text-left text-xs text-muted">
        <tr>
          <th className="border-b border-border py-1.5 pl-4">
            <RowCheckbox
              label="表示中の教材をすべて選択"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={onToggleSelectAll}
            />
          </th>
          <th className={`${th} pl-1`}>教材名</th>
          <th className={`${th} hidden @3xl:table-cell`}>フォルダ</th>
          <th className={`${th} hidden @5xl:table-cell`}>タグ</th>
          <th className={th}>形式</th>
          <th className={`${th} hidden @xl:table-cell`}>更新日</th>
          <th className={`${th} hidden @xl:table-cell`} aria-label="操作" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          switch (row.kind) {
            case 'group':
              return (
                <GroupRow
                  key={`group-${row.key}`}
                  row={row}
                  columnCount={columnCount}
                  selectedIds={selectedIds}
                  onToggle={() => onToggleGroup(row.key)}
                  onSelectMany={onSelectMany}
                />
              );
            case 'bundle':
              return (
                <BundleRow
                  key={`bundle-${row.bundle.id}`}
                  row={row}
                  folders={folders}
                  folderLabel={folderLabel}
                  colorOf={colorOf}
                  cellY={cellY}
                  selectedIds={selectedIds}
                  onToggle={() => onToggleBundle(row.bundle.id)}
                  onEdit={() => onEditBundle(row.bundle)}
                  onSelectMany={onSelectMany}
                  onDragStart={(event) => handleDragStart(event, row.members.map((m) => m.id))}
                  onDragEnd={handleDragEnd}
                  isDropTarget={dropHint !== null && 'bundleId' in dropHint && dropHint.bundleId === row.bundle.id}
                  onDragOverRow={(event) =>
                    dragOverBundle(event, row.bundle, row.members.map((m) => m.id))
                  }
                  onDropRow={(event) => dropOnBundle(event, row.bundle)}
                  hover={hoverOf({ kind: 'bundle', bundle: row.bundle, members: row.members })}
                />
              );
            case 'folder':
              return (
                <FolderRow
                  key={`folder-${row.folder.id}`}
                  row={row}
                  columnCount={columnCount}
                  cellY={cellY}
                  isDropTarget={dropFolderId === row.folder.id}
                  onToggle={() => onToggleFolder(row.folder.id)}
                  onOpen={() => onOpenFolder(row.folder.id)}
                  renaming={renamingFolderId === row.folder.id}
                  onRename={(name) => onRename(row.folder, name)}
                  onCancelRename={onCancelRename}
                  onContextMenu={(x, y) => onFolderContextMenu(row.folder, x, y)}
                  onDragOverChange={(over) => setDropFolderId(over ? row.folder.id : null)}
                  onDropIds={(ids) => {
                    setDropFolderId(null);
                    onDropToFolder(ids, row.folder.id);
                  }}
                />
              );
            default:
              return (
                <MaterialRow
                  key={row.material.id}
                  material={row.material}
                  depth={row.depth}
                  inBundle={row.inBundle}
                  folder={
                    row.material.folder_id !== null
                      ? folders.get(row.material.folder_id)
                      : undefined
                  }
                  folderText={folderLabel(row.material.folder_id)}
                  color={colorOf(row.material.folder_id)}
                  cellY={cellY}
                  now={now}
                  selected={selectedIds.has(row.material.id)}
                  active={activeId === row.material.id}
                  onDragStart={(event) => handleDragStart(event, [row.material.id])}
                  onDragEnd={handleDragEnd}
                  dropMode={materialHint(row.material.id)}
                  onDragOverRow={(event) => dragOverMaterial(event, row.material, row.inBundle)}
                  onDragLeaveRow={() => {
                    if (materialHint(row.material.id)) setDropHint(null);
                  }}
                  onDropRow={(event) => dropOnMaterial(event, row.material)}
                  onToggleSelect={() => onToggleSelect(row.material.id)}
                  onOpen={() => onOpen(row.material)}
                  onOpenViewer={() => onOpenViewer(row.material)}
                  onEdit={() => onEdit(row.material)}
                  onDelete={() => onDelete(row.material)}
                  onTagClick={onTagClick}
                  onToggleFavorite={() => onToggleFavorite(row.material)}
                  onContextMenu={(x, y) => onMaterialContextMenu(row.material, x, y)}
                  renaming={renamingMaterialId === row.material.id}
                  onRename={(title) => onRenameMaterial(row.material, title)}
                  onCancelRename={onCancelRenameMaterial}
                  hover={hoverOf({ kind: 'material', material: row.material })}
                />
              );
          }
        })}
      </tbody>
    </table>
    </div>
  );
}

// 種類ごとの件数（墨一色のアイコン＋件数）。区切り見出しとまとめの行で使う
function TypeBreakdown({ counts }: { counts: Partial<Record<MaterialType, number>> }) {
  return (
    <span className="flex shrink-0 items-center gap-2.5 text-xs text-muted tabular-nums">
      {MATERIAL_TYPES.filter((type) => (counts[type] ?? 0) > 0).map((type) => (
        <span key={type} className="flex items-center gap-0.5">
          <TypeIcon type={type} variant="plain" />
          {counts[type]}
        </span>
      ))}
    </span>
  );
}

// 区切りの見出し行（フォルダ・種類）：フォルダならその色の帯と地、種類なら墨のアイコン。クリックで開閉
function GroupRow({
  row,
  columnCount,
  selectedIds,
  onToggle,
  onSelectMany,
}: {
  row: GroupRowData;
  columnCount: number;
  selectedIds: Set<number>;
  onToggle: () => void;
  onSelectMany: (ids: number[], selected: boolean) => void;
}) {
  const isFolder = row.type === undefined;
  const folderColorName = row.folder?.color ?? null;
  const color = isFolder ? folderColor(folderColorName) : 'var(--foreground)';
  const background = isFolder ? folderTint(folderColorName, 10) : 'var(--surface-muted)';
  const selectedCount = row.ids.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedCount === row.ids.length && row.ids.length > 0;

  return (
    <tr onClick={onToggle} aria-expanded={!row.collapsed} className="cursor-pointer">
      <td
        className="border-y border-border py-1.5 pl-4"
        style={{ ...stripe(color, 6), background }}
        onClick={(event) => event.stopPropagation()}
      >
        <RowCheckbox
          label={`「${row.label}」の教材をすべて選択`}
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={() => onSelectMany(row.ids, !allSelected)}
        />
      </td>
      <td
        className="border-y border-border py-1.5 pr-4 pl-1"
        colSpan={columnCount - 1}
        style={{ background }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <Chevron open={!row.collapsed} />
            {isFolder ? (
              <FolderIcon color={folderColorName} open={!row.collapsed} className="size-4" />
            ) : (
              <TypeIcon type={row.type!} variant="plain" />
            )}
            <span className="truncate font-bold" style={{ color: isFolder ? color : undefined }}>
              {row.label}
            </span>
            <span className="text-xs text-muted tabular-nums">{row.count}件</span>
          </span>
          {isFolder && <TypeBreakdown counts={row.breakdown} />}
        </div>
      </td>
    </tr>
  );
}

// サブフォルダの行：クリックで中身を展開／折りたたみ（トグルリスト）
function FolderRow({
  row,
  columnCount,
  cellY,
  isDropTarget,
  onToggle,
  onOpen,
  onDragOverChange,
  onDropIds,
  renaming,
  onRename,
  onCancelRename,
  onContextMenu,
}: {
  row: Extract<TableRow, { kind: 'folder' }>;
  columnCount: number;
  cellY: string;
  isDropTarget: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDragOverChange: (over: boolean) => void;
  onDropIds: (ids: number[]) => void;
  renaming: boolean;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onContextMenu: (x: number, y: number) => void;
}) {
  const bg = isDropTarget ? 'bg-primary-soft' : 'bg-surface group-hover:bg-surface-muted';
  const td = `border-b border-border ${cellY} ${bg}`;

  return (
    <tr
      onClick={renaming ? undefined : onToggle}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event.clientX, event.clientY);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOverChange(true);
      }}
      onDragLeave={() => onDragOverChange(false)}
      onDrop={(event) => {
        event.preventDefault();
        const ids = readDraggedIds(event);
        if (ids) onDropIds(ids);
        else onDragOverChange(false);
      }}
      aria-expanded={row.expanded}
      className="group cursor-pointer"
    >
      <td className={`${td} pl-4`} style={stripe(folderColor(row.folder.color))} />
      <td className={`${td} pr-3 pl-1`} colSpan={columnCount - 2}>
        <div
          className="flex min-w-0 items-center gap-1.5"
          style={{ paddingLeft: row.depth * INDENT }}
        >
          <Chevron open={row.expanded} />
          <FolderIcon color={row.folder.color} open={row.expanded} />
          {renaming ? (
            <RenameInput
              value={row.folder.name}
              maxLength={MAX_FOLDER_NAME_LENGTH}
              label={`フォルダ「${row.folder.name}」の新しい名前`}
              onCommit={onRename}
              onCancel={onCancelRename}
              className="max-w-72 text-sm"
            />
          ) : (
            <span className="truncate font-bold">{row.folder.name}</span>
          )}
          <span className="shrink-0 text-xs text-muted tabular-nums">{row.count}件</span>
        </div>
      </td>
      <td className={`${td} pr-4 text-right`} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onOpen}
          className="rounded px-2 py-1 text-xs whitespace-nowrap text-primary hover:bg-primary-soft"
        >
          開く
        </button>
      </td>
    </tr>
  );
}

function Cell({ className = '', children }: { className?: string; children?: ReactNode }) {
  return <td className={className}>{children}</td>;
}

function TagList({ tags, onTagClick }: { tags: string[]; onTagClick?: (tag: string) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-hidden text-xs">
      {tags.slice(0, MAX_VISIBLE_TAGS).map((tag) =>
        onTagClick ? (
          <button
            key={tag}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onTagClick(tag);
            }}
            className="max-w-20 shrink truncate rounded border border-border px-1.5 text-foreground hover:border-primary hover:text-primary"
          >
            #{tag}
          </button>
        ) : (
          <span key={tag} className="max-w-20 shrink truncate rounded border border-border px-1.5">
            #{tag}
          </span>
        ),
      )}
      {tags.length > MAX_VISIBLE_TAGS && (
        <span className="text-muted">+{tags.length - MAX_VISIBLE_TAGS}</span>
      )}
    </div>
  );
}

function FolderCell({ folder, text }: { folder: Folder | undefined; text: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-xs ${folder ? '' : 'text-muted'}`}>
      <FolderDot color={folder?.color ?? null} />
      <span className="truncate">{text}</span>
    </span>
  );
}

function MaterialRow({
  material,
  depth,
  inBundle,
  folder,
  folderText,
  color,
  cellY,
  now,
  selected,
  active,
  onDragStart,
  onDragEnd,
  dropMode,
  onDragOverRow,
  onDragLeaveRow,
  onDropRow,
  onToggleSelect,
  onOpen,
  onOpenViewer,
  onEdit,
  onDelete,
  onTagClick,
  onToggleFavorite,
  onContextMenu,
  renaming,
  onRename,
  onCancelRename,
  hover,
}: {
  material: Material;
  depth: number;
  // まとめを展開したときの中身の行
  inBundle: boolean;
  folder: Folder | undefined;
  folderText: string;
  color: string;
  cellY: string;
  now: number;
  selected: boolean;
  active: boolean;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  // ドラッグ中にこの行へ重ねたときの動作（null は対象外）
  dropMode: MaterialDropMode | null;
  onDragOverRow: (event: DragEvent) => void;
  onDragLeaveRow: () => void;
  onDropRow: (event: DragEvent) => void;
  onToggleSelect: () => void;
  onOpen: () => void;
  onOpenViewer: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTagClick: (tag: string) => void;
  onToggleFavorite: () => void;
  onContextMenu: (x: number, y: number) => void;
  renaming: boolean;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  hover: HoverHandlers;
}) {
  const isNew = isWithinDays(material.created_at, NEW_DAYS, now);
  const rowBg =
    dropMode === 'bundle' || active
      ? 'bg-primary-soft'
      : selected
        ? 'bg-primary-soft/60'
        : 'bg-surface group-hover:bg-surface-muted';
  // 並び替えの差し込み位置は、行の上端または下端の太い線で示す
  const dropLine =
    dropMode === 'before'
      ? 'border-t-2 border-t-primary'
      : dropMode === 'after'
        ? 'border-b-2 border-b-primary'
        : '';
  const td = `border-b border-border ${cellY} ${rowBg} ${dropLine}`;

  return (
    <tr
      draggable={!renaming}
      {...hover}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverRow}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) onDragLeaveRow();
      }}
      onDrop={onDropRow}
      onClick={renaming ? undefined : onOpen}
      onDoubleClick={renaming ? undefined : onOpenViewer}
      onContextMenu={(event) => {
        event.preventDefault();
        onContextMenu(event.clientX, event.clientY);
      }}
      className="group cursor-pointer"
      title={inBundle ? 'ドラッグして並び替え／別の教材に重ねるとまとめる' : 'ほかの教材に重ねるとまとめる'}
    >
      <td
        className={`${td} pl-4`}
        style={stripe(color)}
        onClick={(event) => event.stopPropagation()}
      >
        <RowCheckbox
          label={`「${material.title}」を選択`}
          checked={selected}
          onChange={onToggleSelect}
        />
      </td>
      <td className={`${td} pr-3 pl-1`}>
        {/* フォルダ・まとめの中の教材は、見出しの ▶ の幅だけずらして名前と頭をそろえる */}
        <div
          className={`flex min-w-0 items-center gap-2.5 ${
            inBundle ? 'border-l-2 border-primary/40 pl-2' : ''
          }`}
          style={{ marginLeft: depth > 0 ? depth * INDENT + 18 - (inBundle ? 10 : 0) : 0 }}
        >
          <TypeIcon type={material.material_type} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {renaming ? (
                <RenameInput
                  value={material.title}
                  maxLength={MAX_TITLE_LENGTH}
                  label={`「${material.title}」の新しい教材名`}
                  onCommit={onRename}
                  onCancel={onCancelRename}
                  className="text-sm"
                />
              ) : (
                <span className="truncate">{material.title}</span>
              )}
              {!renaming && (
                <FavoriteButton
                  favorite={Boolean(material.favorited_at)}
                  title={material.title}
                  onToggle={onToggleFavorite}
                  hideUntilHover
                  className="-my-1 shrink-0"
                />
              )}
              {dropMode === 'bundle' && (
                <span className="shrink-0 rounded-sm bg-primary px-1.5 text-[11px] leading-5 font-bold text-primary-foreground">
                  {material.bundle_id !== null ? 'このまとめに追加' : 'ここに重ねてまとめる'}
                </span>
              )}
              {isNew && (
                <span className="shrink-0 rounded-sm border border-danger px-1 text-[10px] leading-4 font-bold text-danger">
                  新着
                </span>
              )}
            </div>
            {/* 狭い画面ではフォルダを教材名の下に出す */}
            <div className="flex items-center gap-1 truncate text-xs text-muted @3xl:hidden">
              <FolderDot color={folder?.color ?? null} />
              {folderText}
            </div>
          </div>
        </div>
      </td>
      <Cell className={`${td} hidden px-3 @3xl:table-cell`}>
        <FolderCell folder={folder} text={folderText} />
      </Cell>
      <Cell className={`${td} hidden px-3 @5xl:table-cell`}>
        <TagList tags={material.tags} onTagClick={onTagClick} />
      </Cell>
      <Cell className={`${td} px-3`}>
        {material.file_attached ? (
          <FileBadge fileName={material.file_name} />
        ) : (
          <span className="text-xs text-muted">なし</span>
        )}
      </Cell>
      <Cell className={`${td} hidden px-3 text-xs whitespace-nowrap text-muted tabular-nums @xl:table-cell`}>
        {formatDate(material.updated_at)}
      </Cell>
      <td
        className={`${td} hidden pr-4 text-right @xl:table-cell`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* 普段は隠し、行にマウスを乗せたとき・キーボードで移動したときに出す */}
        <div className="flex justify-end gap-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded px-2 py-1 text-xs text-primary hover:bg-primary-soft"
          >
            編集
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-2 py-1 text-xs text-danger hover:bg-danger-soft"
          >
            削除
          </button>
        </div>
      </td>
    </tr>
  );
}

// まとめの行：中身の概要を表示し、クリックで中のファイルを展開／折りたたみ
function BundleRow({
  row,
  folders,
  folderLabel,
  colorOf,
  cellY,
  selectedIds,
  onToggle,
  onEdit,
  onSelectMany,
  onDragStart,
  onDragEnd,
  isDropTarget,
  onDragOverRow,
  onDropRow,
  hover,
}: {
  row: Extract<TableRow, { kind: 'bundle' }>;
  folders: Map<number, Folder>;
  folderLabel: (folderId: number | null) => string;
  colorOf: (folderId: number | null) => string;
  cellY: string;
  selectedIds: Set<number>;
  onToggle: () => void;
  onEdit: () => void;
  onSelectMany: (ids: number[], selected: boolean) => void;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  isDropTarget: boolean;
  onDragOverRow: (event: DragEvent) => void;
  onDropRow: (event: DragEvent) => void;
  hover: HoverHandlers;
}) {
  const { bundle, members, expanded, depth } = row;
  const ids = members.map((m) => m.id);
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedCount === ids.length && ids.length > 0;

  const breakdown: Partial<Record<MaterialType, number>> = {};
  for (const m of members) breakdown[m.material_type] = (breakdown[m.material_type] ?? 0) + 1;
  const folderIds = [...new Set(members.map((m) => m.folder_id))];
  const singleFolderId = folderIds.length === 1 ? folderIds[0] : undefined;
  const tags = [...new Set(members.flatMap((m) => m.tags))];
  const fileCount = members.filter((m) => m.file_attached).length;
  const latest = members.reduce(
    (max, m) => (m.updated_at > max ? m.updated_at : max),
    members[0]?.updated_at ?? '',
  );
  // 検索などで一部だけ表示しているときは「表示数 / 全体」
  const countLabel =
    members.length === bundle.materials_count
      ? `${members.length}件`
      : `${members.length} / ${bundle.materials_count}件`;

  const bg = isDropTarget
    ? 'bg-primary-soft'
    : allSelected
      ? 'bg-primary-soft/60'
      : 'bg-surface group-hover:bg-surface-muted';
  const td = `border-b border-border ${cellY} ${bg}`;

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      {...hover}
      onClick={onToggle}
      aria-expanded={expanded}
      className="group cursor-pointer"
    >
      <td
        className={`${td} pl-4`}
        style={stripe(singleFolderId !== undefined ? colorOf(singleFolderId) : 'var(--muted)')}
        onClick={(event) => event.stopPropagation()}
      >
        <RowCheckbox
          label={`まとめ「${bundle.name}」の中身をすべて選択`}
          checked={allSelected}
          indeterminate={selectedCount > 0 && !allSelected}
          onChange={() => onSelectMany(ids, !allSelected)}
        />
      </td>
      <td className={`${td} pr-3 pl-1`}>
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * INDENT }}>
          <Chevron open={expanded} />
          <BundleIcon open={expanded} />
          <span className="truncate font-bold">{bundle.name}</span>
          <span className="shrink-0 text-xs text-primary tabular-nums">{countLabel}</span>
          {isDropTarget && (
            <span className="shrink-0 rounded-sm bg-primary px-1.5 text-[11px] leading-5 font-bold text-primary-foreground">
              このまとめに追加
            </span>
          )}
          <span className="hidden @xl:flex">
            <TypeBreakdown counts={breakdown} />
          </span>
        </div>
      </td>
      <Cell className={`${td} hidden px-3 @3xl:table-cell`}>
        {singleFolderId !== undefined ? (
          <FolderCell
            folder={singleFolderId !== null ? folders.get(singleFolderId) : undefined}
            text={folderLabel(singleFolderId)}
          />
        ) : (
          <span className="text-xs text-muted">複数のフォルダ</span>
        )}
      </Cell>
      <Cell className={`${td} hidden px-3 @5xl:table-cell`}>
        <TagList tags={tags} />
      </Cell>
      <Cell className={`${td} px-3 text-xs whitespace-nowrap text-muted tabular-nums`}>
        {fileCount > 0 ? `${fileCount}件` : 'なし'}
      </Cell>
      <Cell className={`${td} hidden px-3 text-xs whitespace-nowrap text-muted tabular-nums @xl:table-cell`}>
        {latest && formatDate(latest)}
      </Cell>
      <td
        className={`${td} hidden pr-4 text-right @xl:table-cell`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onEdit}
          className="rounded px-2 py-1 text-xs whitespace-nowrap text-primary opacity-0 group-hover:opacity-100 hover:bg-primary-soft focus:opacity-100"
        >
          編集
        </button>
      </td>
    </tr>
  );
}
