'use client';

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { FolderDot } from '@/components/ui/FolderDot';
import { StarIcon } from '@/components/ui/FavoriteStar';
import { FolderIcon } from '@/components/ui/FolderIcon';
import { RenameInput } from '@/components/ui/RenameInput';
import { TypeIcon } from '@/components/ui/TypeIcon';
import {
  FOLDER_DRAG_TYPE,
  planFolderDrop,
  zoneFromPointer,
  type FolderDropPlan,
  type FolderDropZone,
} from '@/lib/folderDrag';
import { folderPath, type FolderIndex } from '@/lib/folderTree';
import { countValues, matchesScope } from '@/lib/materialView';
import { folderColor } from '@/lib/folderColors';
import {
  MAX_FOLDER_DEPTH,
  MAX_FOLDER_NAME_LENGTH,
  type Folder,
  type Material,
  type Scope,
  type ViewFilters,
} from '@/types/material';

// 一覧の行をドラッグしたときに渡す教材IDの形式
export const DRAG_TYPE = 'application/x-mateorg-material-ids';

// ドロップされた教材IDを取り出す（対象外のドラッグなら null）
export function readDraggedIds(event: DragEvent): number[] | null {
  if (!event.dataTransfer.types.includes(DRAG_TYPE)) return null;
  const ids = JSON.parse(event.dataTransfer.getData(DRAG_TYPE) || '[]') as number[];
  return ids.length > 0 ? ids : null;
}

type Props = {
  materials: Material[];
  folderIndex: FolderIndex;
  filters: ViewFilters;
  now: number;
  // スマホ表示でのオーバーレイ表示
  open: boolean;
  onClose: () => void;
  // PC 表示で折りたたむ／折りたたんだ簡易表示（アイコンの帯）から元に戻す
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  expandedFolders: Set<number>;
  onToggleFolderExpand: (id: number) => void;
  onScopeChange: (scope: Scope) => void;
  onTagToggle: (tag: string) => void;
  onAddMaterial: () => void;
  onCreateFolder: (parentId: number | null) => void;
  onEditFolder: (folder: Folder) => void;
  // その場での名前の変更（ダブルクリック・F2・右クリックメニュー）
  renamingFolderId: number | null;
  onStartRename: (folder: Folder) => void;
  onRename: (folder: Folder, name: string) => void;
  onCancelRename: () => void;
  // 右クリックメニュー
  onFolderContextMenu: (folder: Folder, x: number, y: number) => void;
  onDropToFolder: (ids: number[], folderId: number | null) => void;
  // 「お気に入り」へ教材をドロップしたとき
  onDropToFavorites: (ids: number[]) => void;
  // フォルダをドラッグして並び替え・別のフォルダの中へ移動
  onArrangeFolder: (folderId: number, plan: FolderDropPlan) => void;
  onOpenSettings: () => void;
  // ログイン中の利用者のメールアドレスとログアウト
  userEmail: string;
  onLogout: () => void;
  // 詳細パネルで開いている教材（フォルダを展開したときの教材名を強調する）
  activeMaterialId: number | null;
  // 展開したフォルダの教材名：クリックで詳細、ダブルクリックでビューア
  onOpenMaterial: (material: Material) => void;
  onOpenViewer: (material: Material) => void;
  // ゴミ箱：件数・開く・教材をドロップしてゴミ箱へ移す
  trashCount: number;
  onOpenTrash: () => void;
  onDropToTrash: (ids: number[]) => void;
};

// フォルダをドラッグ中に、どこへ何をしようとしているか（targetId が null は最上位の末尾）
type FolderHint = { targetId: number | null; zone: FolderDropZone; plan: FolderDropPlan };

// ドラッグしたまま閉じたフォルダに重ねておくと開くまでの時間
const AUTO_EXPAND_MS = 700;

const sameScope = (a: Scope, b: Scope) =>
  a.kind === b.kind && (a.kind !== 'folder' || (b.kind === 'folder' && a.id === b.id));

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-3">
        <h3 className="text-xs font-bold text-sidebar-muted">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

type ItemProps = {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
  // フォルダの字下げ
  depth?: number;
  // 先頭の開閉ボタン（フォルダのみ）
  leading?: ReactNode;
  // ホバー時に件数の位置へ重ねて表示するボタン
  actions?: ReactNode;
  // 現在のフォルダ：フォルダの色の帯と地で強調する
  accent?: string;
  // 現在のフォルダの親（道筋）：左に細い縦線を出す
  trail?: boolean;
  // 名前の変更中は、ボタンの代わりにこの入力欄を出す
  editor?: ReactNode;
  onDoubleClick?: () => void;
  onContextMenu?: (x: number, y: number) => void;
  // F2 で名前の変更を始める
  onRenameKey?: () => void;
  // ドロップを受け付ける場合に指定
  dropKey?: string;
  dragOverKey?: string | null;
  onDragOverKey?: (key: string | null) => void;
  onDropIds?: (ids: number[]) => void;
  // フォルダのドラッグ（並び替え・移動）
  onDragStartItem?: (event: DragEvent) => void;
  onDragEndItem?: () => void;
  // フォルダを重ねたとき：受け付けるなら true（呼び出し側で位置を判定する）
  onFolderDragOver?: (event: DragEvent) => boolean;
  onFolderDrop?: () => void;
  // 重ねている位置の表示（前・中・後ろ）
  folderZone?: FolderDropZone | null;
};

function Item({
  active,
  count,
  onClick,
  children,
  depth = 0,
  leading,
  actions,
  accent,
  trail = false,
  editor,
  onDoubleClick,
  onContextMenu,
  onRenameKey,
  dropKey,
  dragOverKey,
  onDragOverKey,
  onDropIds,
  onDragStartItem,
  onDragEndItem,
  onFolderDragOver,
  onFolderDrop,
  folderZone = null,
}: ItemProps) {
  const isDropTarget =
    (dropKey !== undefined && dragOverKey === dropKey) || folderZone === 'inside';

  function handleDragOver(event: DragEvent) {
    if (event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) {
      if (onFolderDragOver?.(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
      return;
    }
    if (!onDropIds || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onDragOverKey?.(dropKey ?? null);
  }

  function handleDrop(event: DragEvent) {
    if (event.dataTransfer.types.includes(FOLDER_DRAG_TYPE)) {
      event.preventDefault();
      onFolderDrop?.();
      return;
    }
    if (!onDropIds) return;
    event.preventDefault();
    onDragOverKey?.(null);
    const ids = readDraggedIds(event);
    if (ids) onDropIds(ids);
  }

  return (
    <div
      draggable={Boolean(onDragStartItem) && !editor}
      onDragStart={onDragStartItem}
      onDragEnd={onDragEndItem}
      onDragOver={handleDragOver}
      onDragLeave={() => dragOverKey === dropKey && dropKey !== undefined && onDragOverKey?.(null)}
      onDrop={handleDrop}
      style={{
        paddingLeft: depth * 14,
        ...(active && accent
          ? {
              background: `color-mix(in srgb, ${accent} 30%, var(--sidebar))`,
              boxShadow: `inset 3px 0 0 ${accent}`,
            }
          : {}),
      }}
      className={`group relative flex items-center rounded-md ${
        isDropTarget
          ? 'bg-sidebar-active ring-2 ring-primary'
          : active
            ? accent
              ? ''
              : 'bg-sidebar-active'
            : 'hover:bg-sidebar-hover'
      }`}
    >
      {trail && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 w-0.5 rounded-full bg-sidebar-muted/60"
          style={{ left: depth * 14 + 2 }}
        />
      )}
      {/* フォルダを並び替えるときの差し込み位置 */}
      {(folderZone === 'before' || folderZone === 'after') && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute right-1 h-0.5 rounded-full bg-primary ${
            folderZone === 'before' ? '-top-px' : '-bottom-px'
          }`}
          style={{ left: depth * 14 + 6 }}
        >
          <span className="absolute -top-[3px] -left-1 size-2 rounded-full border-2 border-primary bg-sidebar" />
        </span>
      )}
      {leading}
      {editor ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-2 pl-0.5">{editor}</div>
      ) : (
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={
          onContextMenu &&
          ((event) => {
            event.preventDefault();
            // メニューキー・Shift+F10 のときは座標が 0 なので、項目の下に出す
            const rect = event.currentTarget.getBoundingClientRect();
            const fromKeyboard = event.clientX === 0 && event.clientY === 0;
            onContextMenu(
              fromKeyboard ? rect.left + 24 : event.clientX,
              fromKeyboard ? rect.bottom : event.clientY,
            );
          })
        }
        onKeyDown={(event) => {
          if (event.key === 'F2' && onRenameKey) {
            event.preventDefault();
            onRenameKey();
          }
        }}
        className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-3 text-left text-[13px] ${
          leading ? 'pl-0.5' : 'pl-3'
        } ${
          active
            ? 'font-bold text-sidebar-active-foreground'
            : trail
              ? 'font-bold text-sidebar-foreground'
              : 'text-sidebar-foreground'
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
        {folderZone === 'inside' && (
          <span className="shrink-0 rounded-sm bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
            この中へ
          </span>
        )}
        <span
          className={`text-[11px] tabular-nums text-sidebar-muted ${
            actions ? 'group-hover:invisible group-focus-within:invisible' : ''
          }`}
        >
          {count}
        </span>
      </button>
      )}
      {actions && !editor && (
        <div className="absolute right-1 flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
}

// 展開したフォルダに並べる教材名の上限（多いときは一覧へ案内する）
const FILE_LIMIT = 50;
const titleOrder = new Intl.Collator('ja', { numeric: true });

// ゴミ箱の形（線画）
function TrashGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5" />
    </svg>
  );
}

const iconButton =
  'rounded px-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground';

// 簡易表示の1項目：アイコンの下に短い名前（YouTube の畳んだサイドバーと同じ形）
function RailItem({
  label,
  icon,
  active = false,
  accent,
  count,
  onClick,
  dropKey,
  dragOverKey,
  onDragOverKey,
  onDropIds,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  // 今いるフォルダの色（左端の帯）
  accent?: string;
  count?: number;
  onClick: () => void;
  dropKey?: string;
  dragOverKey?: string | null;
  onDragOverKey?: (key: string | null) => void;
  onDropIds?: (ids: number[]) => void;
}) {
  const isDropTarget = dropKey !== undefined && dragOverKey === dropKey;
  const title = count !== undefined ? `${label}（${count}件）` : label;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-current={active ? 'page' : undefined}
      onDragOver={(event) => {
        if (!onDropIds || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragOverKey?.(dropKey ?? null);
      }}
      onDragLeave={() => isDropTarget && onDragOverKey?.(null)}
      onDrop={(event) => {
        if (!onDropIds) return;
        event.preventDefault();
        onDragOverKey?.(null);
        const ids = readDraggedIds(event);
        if (ids) onDropIds(ids);
      }}
      style={
        active && accent
          ? {
              background: `color-mix(in srgb, ${accent} 30%, var(--sidebar))`,
              boxShadow: `inset 3px 0 0 ${accent}`,
            }
          : undefined
      }
      className={`relative flex w-full flex-col items-center gap-1 rounded-md px-1 pt-2 pb-1.5 text-sidebar-foreground ${
        isDropTarget
          ? 'bg-sidebar-active ring-2 ring-primary'
          : active
            ? accent
              ? ''
              : 'bg-sidebar-active text-sidebar-active-foreground'
            : 'hover:bg-sidebar-hover'
      }`}
    >
      <span className="flex size-6 items-center justify-center">{icon}</span>
      <span className={`w-full truncate text-center text-[11px] leading-tight ${active ? 'font-bold' : ''}`}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="absolute top-1 right-1.5 min-w-4 rounded-full bg-sidebar-hover px-1 text-center text-[10px] leading-4 tabular-nums text-sidebar-muted">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

const railIcon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

export function Sidebar({
  materials,
  folderIndex,
  filters,
  now,
  open,
  onClose,
  collapsed,
  onCollapse,
  onExpand,
  expandedFolders,
  onToggleFolderExpand,
  onScopeChange,
  onTagToggle,
  onAddMaterial,
  onCreateFolder,
  onEditFolder,
  renamingFolderId,
  onStartRename,
  onRename,
  onCancelRename,
  onFolderContextMenu,
  onDropToFolder,
  onDropToFavorites,
  onArrangeFolder,
  onOpenSettings,
  activeMaterialId,
  onOpenMaterial,
  onOpenViewer,
  trashCount,
  onOpenTrash,
  onDropToTrash,
  userEmail,
  onLogout,
}: Props) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // ドラッグ中のフォルダ（dragover 中は dataTransfer の中身を読めないため、ここで覚えておく）
  const draggingFolderId = useRef<number | null>(null);
  const [draggingFolder, setDraggingFolder] = useState(false);
  const [folderHint, setFolderHint] = useState<FolderHint | null>(null);

  // ドラッグしたまま閉じたフォルダに重ねておくと、そのフォルダを開く
  const hoverTarget =
    folderHint?.zone === 'inside' && folderHint.targetId !== null ? folderHint.targetId : null;
  useEffect(() => {
    if (hoverTarget === null || expandedFolders.has(hoverTarget)) return;
    if ((folderIndex.children.get(hoverTarget) ?? []).length === 0) return;
    const timer = window.setTimeout(() => onToggleFolderExpand(hoverTarget), AUTO_EXPAND_MS);
    return () => window.clearTimeout(timer);
  }, [hoverTarget, expandedFolders, folderIndex, onToggleFolderExpand]);

  function startFolderDrag(event: DragEvent, folder: Folder) {
    draggingFolderId.current = folder.id;
    event.dataTransfer.setData(FOLDER_DRAG_TYPE, String(folder.id));
    event.dataTransfer.effectAllowed = 'move';
    // ドラッグ開始と同時に要素を増やすとドラッグが取り消されることがあるため、次のタイミングで出す
    window.setTimeout(() => setDraggingFolder(true), 0);
  }

  function endFolderDrag() {
    draggingFolderId.current = null;
    setDraggingFolder(false);
    setFolderHint(null);
  }

  // 重ねた位置で並べ方を計算する。動かせない位置なら false（ドロップを受け付けない）
  function overFolder(event: DragEvent, targetId: number | null): boolean {
    const draggedId = draggingFolderId.current;
    if (draggedId === null) return false;
    const zone =
      targetId === null
        ? 'inside'
        : zoneFromPointer(event.clientY, event.currentTarget.getBoundingClientRect());
    const plan = planFolderDrop(folderIndex, draggedId, targetId, zone);
    const same = folderHint?.targetId === targetId && folderHint.zone === zone;
    if (!plan) {
      if (folderHint?.targetId === targetId) setFolderHint(null);
      return false;
    }
    if (!same) setFolderHint({ targetId, zone, plan });
    return true;
  }

  function dropFolder() {
    const draggedId = draggingFolderId.current;
    const hint = folderHint;
    endFolderDrag();
    if (draggedId !== null && hint) onArrangeFolder(draggedId, hint.plan);
  }

  const zoneOf = (targetId: number) =>
    folderHint && folderHint.targetId === targetId ? folderHint.zone : null;

  const counts = useMemo(() => {
    const count = (scope: Scope) =>
      materials.filter((m) => matchesScope(m, scope, { now })).length;

    // フォルダの件数はサブフォルダの分も含める
    const direct = new Map<number, number>();
    for (const m of materials) {
      if (m.folder_id !== null) direct.set(m.folder_id, (direct.get(m.folder_id) ?? 0) + 1);
    }
    const subtree = new Map<number, number>();
    const total = (id: number): number => {
      if (subtree.has(id)) return subtree.get(id)!;
      const value =
        (direct.get(id) ?? 0) +
        (folderIndex.children.get(id) ?? []).reduce((sum, c) => sum + total(c.id), 0);
      subtree.set(id, value);
      return value;
    };
    for (const id of folderIndex.byId.keys()) total(id);

    return {
      all: materials.length,
      recent: count({ kind: 'recent' }),
      favorites: count({ kind: 'favorites' }),
      opened: count({ kind: 'opened' }),
      unfiled: count({ kind: 'unfiled' }),
      folders: subtree,
      tags: countValues(materials.flatMap((m) => m.tags)),
    };
  }, [materials, folderIndex, now]);

  // 現在のフォルダと、その親（道筋）
  const currentFolderId = filters.scope.kind === 'folder' ? filters.scope.id : null;
  const trailIds = new Set(
    currentFolderId !== null
      ? folderPath(folderIndex, currentFolderId)
          .slice(0, -1)
          .map((f) => f.id)
      : [],
  );

  const select = (scope: Scope) => {
    onScopeChange(scope);
    onClose();
  };

  // 折りたたんだときの簡易表示（PC 幅のみ。スマホは重ねて開くサイドバーを使う）
  if (collapsed) {
    const topFolderId =
      currentFolderId !== null ? (folderPath(folderIndex, currentFolderId)[0]?.id ?? null) : null;
    const railDrop = { dragOverKey, onDragOverKey: setDragOverKey };
    return (
      <aside
        aria-label="サイドバー（簡易表示）"
        className="hidden w-[72px] shrink-0 flex-col items-stretch border-r border-sidebar-border bg-sidebar px-1 text-sidebar-foreground lg:flex"
      >
        <div className="flex flex-col items-center gap-2 pt-4 pb-2">
          <button
            type="button"
            onClick={onExpand}
            aria-label="サイドバーを広げる"
            title="サイドバーを広げる"
            className={`py-0.5 text-lg leading-none ${iconButton}`}
          >
            »
          </button>
          <button
            type="button"
            onClick={onAddMaterial}
            aria-label="教材を追加"
            title="教材を追加（N キー）"
            className="flex size-10 items-center justify-center rounded-lg bg-primary text-xl leading-none text-primary-foreground hover:bg-primary-hover"
          >
            ＋
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2">
          <RailItem
            label="すべて"
            count={counts.all}
            active={sameScope(filters.scope, { kind: 'all' })}
            onClick={() => select({ kind: 'all' })}
            icon={railIcon(
              <>
                <rect x="4" y="4" width="7" height="7" rx="1.5" />
                <rect x="13" y="4" width="7" height="7" rx="1.5" />
                <rect x="4" y="13" width="7" height="7" rx="1.5" />
                <rect x="13" y="13" width="7" height="7" rx="1.5" />
              </>,
            )}
          />
          <RailItem
            label="お気に入り"
            count={counts.favorites}
            active={sameScope(filters.scope, { kind: 'favorites' })}
            onClick={() => select({ kind: 'favorites' })}
            dropKey="favorites"
            onDropIds={onDropToFavorites}
            {...railDrop}
            icon={<StarIcon filled={sameScope(filters.scope, { kind: 'favorites' })} className="size-5" />}
          />
          <RailItem
            label="最近使った"
            count={counts.opened}
            active={sameScope(filters.scope, { kind: 'opened' })}
            onClick={() => select({ kind: 'opened' })}
            icon={railIcon(
              <>
                <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
                <path d="M4 4.5v3h3" />
                <path d="M12 8v4l2.5 1.5" />
              </>,
            )}
          />
          <RailItem
            label="新着"
            count={counts.recent}
            active={sameScope(filters.scope, { kind: 'recent' })}
            onClick={() => select({ kind: 'recent' })}
            icon={railIcon(
              <>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 7.5V12l3 2" />
              </>,
            )}
          />
          <RailItem
            label="未分類"
            count={counts.unfiled}
            active={sameScope(filters.scope, { kind: 'unfiled' })}
            onClick={() => select({ kind: 'unfiled' })}
            dropKey="unfiled"
            onDropIds={(ids) => onDropToFolder(ids, null)}
            {...railDrop}
            icon={railIcon(
              <>
                <path d="M4 13.5 6.5 5h11l2.5 8.5V19H4z" />
                <path d="M4 13.5h4.5l1 2h5l1-2H20" />
              </>,
            )}
          />
          <RailItem
            label="ゴミ箱"
            count={trashCount}
            onClick={onOpenTrash}
            dropKey="trash"
            onDropIds={onDropToTrash}
            {...railDrop}
            icon={<TrashGlyph className="size-5" />}
          />

          <hr className="mx-2 my-1.5 border-sidebar-border" />

          {(folderIndex.children.get(null) ?? []).map((folder) => (
            <RailItem
              key={folder.id}
              label={folder.name}
              count={counts.folders.get(folder.id) ?? 0}
              active={topFolderId === folder.id}
              accent={folderColor(folder.color)}
              onClick={() => select({ kind: 'folder', id: folder.id })}
              dropKey={`folder-${folder.id}`}
              onDropIds={(ids) => onDropToFolder(ids, folder.id)}
              {...railDrop}
              icon={<FolderIcon color={folder.color} open={topFolderId === folder.id} className="size-6" />}
            />
          ))}
          {folderIndex.byId.size === 0 && (
            <RailItem
              label="フォルダ作成"
              onClick={() => onCreateFolder(null)}
              icon={railIcon(<path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 10.5v5M9.5 13h5" />)}
            />
          )}
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-sidebar-border py-2">
          <RailItem
            label="タグ"
            onClick={onExpand}
            icon={<span className="text-lg leading-none font-bold">#</span>}
          />
          <RailItem
            label="設定"
            onClick={onOpenSettings}
            icon={railIcon(
              <>
                <path d="M4 7h9m4 0h3M4 17h3m4 0h9" />
                <circle cx="15" cy="7" r="2" />
                <circle cx="9" cy="17" r="2" />
              </>,
            )}
          />
        </div>
      </aside>
    );
  }
  const dropProps = { dragOverKey, onDragOverKey: setDragOverKey };

  // 展開したフォルダの中の教材名（フォルダの直下にあるものだけ。名前順）
  const materialsByFolder = new Map<number, Material[]>();
  for (const material of materials) {
    if (material.folder_id === null) continue;
    const list = materialsByFolder.get(material.folder_id) ?? [];
    list.push(material);
    materialsByFolder.set(material.folder_id, list);
  }
  for (const list of materialsByFolder.values()) list.sort((a, b) => titleOrder.compare(a.title, b.title));

  const renderFiles = (folder: Folder, files: Material[], depth: number) => (
    <ul aria-label={`「${folder.name}」の教材`}>
      {files.slice(0, FILE_LIMIT).map((material) => {
        const active = activeMaterialId === material.id;
        return (
          <li key={material.id}>
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(DRAG_TYPE, JSON.stringify([material.id]));
                event.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onOpenMaterial(material)}
              onDoubleClick={() => onOpenViewer(material)}
              title={`${material.title}${material.file_name ? `（${material.file_name}）` : ''}
クリックで詳細、ダブルクリックで中身を表示`}
              aria-current={active ? 'true' : undefined}
              className={`flex w-full min-w-0 items-start gap-2 rounded-md py-1 pr-3 text-left text-xs leading-snug ${
                active
                  ? 'bg-sidebar-active font-bold text-sidebar-active-foreground'
                  : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
              }`}
              style={{ paddingLeft: depth * 14 + 24 }}
            >
              <TypeIcon type={material.material_type} variant="plain" className="mt-px" />
              {/* 長い名前も見分けられるよう2行まで出す */}
              <span className="line-clamp-2 min-w-0">{material.title}</span>
            </button>
          </li>
        );
      })}
      {files.length > FILE_LIMIT && (
        <li>
          <button
            type="button"
            onClick={() => select({ kind: 'folder', id: folder.id })}
            className="w-full py-1 pr-3 text-left text-[11px] text-sidebar-muted hover:text-sidebar-foreground"
            style={{ paddingLeft: depth * 14 + 24 }}
          >
            ほか {files.length - FILE_LIMIT} 件を一覧で見る
          </button>
        </li>
      )}
    </ul>
  );

  // フォルダの木を再帰的に描画する
  const renderFolders = (parentId: number | null, depth: number): ReactNode =>
    (folderIndex.children.get(parentId) ?? []).map((folder) => {
      const children = folderIndex.children.get(folder.id) ?? [];
      const expanded = expandedFolders.has(folder.id);
      const files = materialsByFolder.get(folder.id) ?? [];

      return (
        <div key={folder.id}>
          <Item
            depth={depth}
            active={sameScope(filters.scope, { kind: 'folder', id: folder.id })}
            accent={folderColor(folder.color)}
            trail={trailIds.has(folder.id)}
            count={counts.folders.get(folder.id) ?? 0}
            onClick={() => select({ kind: 'folder', id: folder.id })}
            onDoubleClick={() => onStartRename(folder)}
            onRenameKey={() => onStartRename(folder)}
            onContextMenu={(x, y) => onFolderContextMenu(folder, x, y)}
            editor={
              renamingFolderId === folder.id ? (
                <>
                  <FolderDot color={folder.color} />
                  <RenameInput
                    value={folder.name}
                    maxLength={MAX_FOLDER_NAME_LENGTH}
                    label={`フォルダ「${folder.name}」の新しい名前`}
                    onCommit={(name) => onRename(folder, name)}
                    onCancel={onCancelRename}
                  />
                </>
              ) : undefined
            }
            dropKey={`folder-${folder.id}`}
            onDropIds={(ids) => onDropToFolder(ids, folder.id)}
            {...dropProps}
            onDragStartItem={(event) => startFolderDrag(event, folder)}
            onDragEndItem={endFolderDrag}
            onFolderDragOver={(event) => overFolder(event, folder.id)}
            onFolderDrop={dropFolder}
            folderZone={zoneOf(folder.id)}
            leading={
              <button
                type="button"
                onClick={() => onToggleFolderExpand(folder.id)}
                aria-label={expanded ? `「${folder.name}」を閉じる` : `「${folder.name}」を開く`}
                aria-expanded={expanded}
                className={`ml-1 flex size-5 shrink-0 items-center justify-center rounded text-[10px] text-sidebar-muted hover:bg-sidebar-hover ${
                  children.length === 0 && files.length === 0 ? 'invisible' : ''
                }`}
              >
                <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
              </button>
            }
            actions={
              <>
                {depth + 1 < MAX_FOLDER_DEPTH && (
                  <button
                    type="button"
                    onClick={() => onCreateFolder(folder.id)}
                    aria-label={`「${folder.name}」の中にフォルダを作成`}
                    title="この中にフォルダを作成"
                    className={iconButton}
                  >
                    ＋
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEditFolder(folder)}
                  aria-label={`フォルダ「${folder.name}」を編集`}
                  title="名前・色・場所の変更、削除（右クリックでも操作できます）"
                  className={iconButton}
                >
                  ⋯
                </button>
              </>
            }
          >
            <FolderDot color={folder.color} />
            <span className="truncate">{folder.name}</span>
          </Item>
          {expanded && renderFolders(folder.id, depth + 1)}
          {expanded && files.length > 0 && renderFiles(folder, files, depth + 1)}
        </div>
      );
    });

  return (
    <>
      {/* スマホ表示時の背景 */}
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          {/* バインダーのインデックスタブを模した目印（フォルダの色の最初の3色） */}
          <span aria-hidden="true" className="flex h-6 items-end gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 rounded-t-sm"
                style={{ height: `${100 - i * 22}%`, background: `var(--fc-${['blue', 'green', 'yellow'][i]})` }}
              />
            ))}
          </span>
          <span className="flex-1 text-[15px] font-bold">MaterialOrg</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onCollapse();
            }}
            aria-label="サイドバーをしまう"
            title="サイドバーをしまう"
            className={`hidden py-0.5 text-lg leading-none lg:block ${iconButton}`}
          >
            «
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="メニューを閉じる"
            className={`py-0.5 text-lg leading-none lg:hidden ${iconButton}`}
          >
            ×
          </button>
        </div>

        <div className="px-3 pb-4">
          <button
            type="button"
            onClick={onAddMaterial}
            className="w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
          >
            ＋ 教材を追加
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 pb-4">
          <Section title="ライブラリ">
            <Item
              active={sameScope(filters.scope, { kind: 'all' })}
              count={counts.all}
              onClick={() => select({ kind: 'all' })}
            >
              すべての教材
            </Item>
            <Item
              active={sameScope(filters.scope, { kind: 'favorites' })}
              count={counts.favorites}
              onClick={() => select({ kind: 'favorites' })}
              dropKey="favorites"
              onDropIds={onDropToFavorites}
              {...dropProps}
            >
              <StarIcon filled={sameScope(filters.scope, { kind: 'favorites' })} className="size-3.5" />
              お気に入り
            </Item>
            <Item
              active={sameScope(filters.scope, { kind: 'opened' })}
              count={counts.opened}
              onClick={() => select({ kind: 'opened' })}
            >
              最近使った資料
            </Item>
            <Item
              active={sameScope(filters.scope, { kind: 'recent' })}
              count={counts.recent}
              onClick={() => select({ kind: 'recent' })}
            >
              最近追加（7日以内）
            </Item>
            <Item
              active={sameScope(filters.scope, { kind: 'unfiled' })}
              count={counts.unfiled}
              onClick={() => select({ kind: 'unfiled' })}
              dropKey="unfiled"
              onDropIds={(ids) => onDropToFolder(ids, null)}
              {...dropProps}
            >
              未分類
            </Item>
            <Item
              active={false}
              count={trashCount}
              onClick={onOpenTrash}
              dropKey="trash"
              onDropIds={onDropToTrash}
              {...dropProps}
            >
              <TrashGlyph className="size-3.5" />
              ゴミ箱
            </Item>
          </Section>

          <Section
            title="フォルダ"
            action={
              <button
                type="button"
                onClick={() => onCreateFolder(null)}
                aria-label="フォルダを作成"
                title="フォルダを作成"
                className={`text-base leading-none ${iconButton}`}
              >
                ＋
              </button>
            }
          >
            {folderIndex.byId.size === 0 && (
              <p className="px-3 py-1 text-xs text-sidebar-muted">
                ＋からフォルダを作成できます
              </p>
            )}
            {renderFolders(null, 0)}
            {draggingFolder && (
              <div
                onDragOver={(event) => {
                  if (overFolder(event, null)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  dropFolder();
                }}
                className={`mx-1 mt-1 rounded-md border border-dashed px-3 py-1.5 text-xs ${
                  folderHint?.targetId === null
                    ? 'border-primary bg-sidebar-active text-sidebar-foreground'
                    : 'border-sidebar-border text-sidebar-muted'
                }`}
              >
                ここに置くと最上位へ
              </div>
            )}
          </Section>


          {counts.tags.length > 0 && (
            <Section title="タグ">
              {counts.tags.map(({ name, count }) => (
                <Item
                  key={name}
                  active={filters.tag === name}
                  count={count}
                  onClick={() => {
                    onTagToggle(name);
                    onClose();
                  }}
                >
                  <span className="text-sidebar-muted">#</span>
                  <span className="truncate">{name}</span>
                </Item>
              ))}
            </Section>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-sidebar-foreground hover:bg-sidebar-hover"
          >
            <span aria-hidden="true">⚙</span>
            設定（表示・アカウント）
          </button>
          <div className="flex items-center gap-2 px-3 pt-1 pb-0.5 text-[11px] text-sidebar-muted">
            <span className="min-w-0 flex-1 truncate" title={userEmail}>
              {userEmail}
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="shrink-0 rounded px-1.5 py-0.5 hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              ログアウト
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
