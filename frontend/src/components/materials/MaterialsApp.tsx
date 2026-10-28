'use client';

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BundleDialog } from '@/components/bundles/BundleDialog';
import { FolderDialog } from '@/components/folders/FolderDialog';
import { SettingsDialog } from '@/components/layout/SettingsDialog';
import { DRAG_TYPE, Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { folderColorLabels } from '@/components/ui/typeStyles';
import { Drawer } from '@/components/ui/Drawer';
import { DropOverlay } from '@/components/ui/DropOverlay';
import { FolderDot } from '@/components/ui/FolderDot';
import { FolderIcon } from '@/components/ui/FolderIcon';
import { useBundles } from '@/hooks/useBundles';
import { useFolders } from '@/hooks/useFolders';
import { useMaterials } from '@/hooks/useMaterials';
import { usePreferences } from '@/hooks/usePreferences';
import {
  buildFolderIndex,
  buildFolderRows,
  flattenFolders,
  folderDepth,
  folderPath,
  indentedName,
  subtreeIds,
  type TableRow,
} from '@/lib/folderTree';
import { buildGroupedRows } from '@/lib/grouping';
import { compareBundleNames, moveInOrder, sortBundleMembers } from '@/lib/bundles';
import type { FolderDropPlan } from '@/lib/folderDrag';
import {
  arrangeFolders,
  assignBundle,
  deleteMaterial,
  markOpened,
  moveMaterials,
  setFavorite,
  reorderBundle,
  saveFolder,
  updateMaterialFields,
} from '@/lib/materialsApi';
import {
  countByType,
  countValues,
  filterMaterials,
  type ViewContext,
} from '@/lib/materialView';
import { folderColor, folderTint } from '@/lib/folderColors';
import {
  FOLDER_COLORS,
  MATERIAL_TYPES,
  MAX_FOLDER_DEPTH,
  PRESET_TAGS,
  typeLabels,
  type FolderColor,
  type Bundle,
  type Density,
  type Folder,
  type Material,
  type MaterialFormValues,
  type MaterialType,
  type Scope,
  type SortOrder,
  type ViewFilters,
} from '@/types/material';
import { BulkActionBar } from './BulkActionBar';
import { MaterialDetail } from './MaterialDetail';
import { MaterialForm } from './MaterialForm';
import { HoverPreview } from '@/components/preview/HoverPreview';

// ビューアは初めて開いたときに読み込む（PDF・Office の表示部品が大きいため）
const FileViewer = lazy(() => import('@/components/viewer/FileViewer'));
import { useCanHover } from '@/components/preview/hooks';
import { splitRows, type ListColumns } from '@/lib/listColumns';
import {
  MaterialTable,
  selectableIdsOf,
  type HoverInfo,
  type MaterialDropMode,
} from './MaterialTable';
import { ShelfMap, type MapTarget } from './ShelfMap';
import { SEARCH_INPUT_ID, SearchBox } from './SearchBox';
import { Toolbar } from './Toolbar';
import { TypeTabs } from './TypeTabs';
import { titleFromFileName, UploadQueueDialog } from './UploadQueueDialog';

type Notice = { type: 'success' | 'error'; text: string } | null;

// 右パネルの表示内容（create の file は画面にドロップされたファイル）
type Panel =
  | { mode: 'create'; file?: File }
  | { mode: 'edit'; id: number }
  | { mode: 'detail'; id: number }
  | null;

// フォルダの作成・編集ダイアログ（作成時は親フォルダを指定）
type FolderDialogState = { folder: Folder | null; parentId: number | null } | null;

// まとめの作成・編集ダイアログ（作成時は選択中の教材、編集時はまとめの中身）
// 2列・3列表示で1列に必要な幅（これより狭くなるなら列数を減らす）
const MIN_COLUMN_WIDTH = 420;

type FolderPlace = 'sidebar' | 'table';

type BundleDialogState = { bundle: Bundle | null; materials: Material[] } | null;

const initialFilters: ViewFilters = {
  scope: { kind: 'all' },
  type: 'all',
  tag: null,
  query: '',
};

const scopeLabels: Record<Exclude<Scope['kind'], 'folder'>, string> = {
  all: 'すべての教材',
  recent: '最近追加（7日以内）',
  unfiled: '未分類',
  favorites: 'お気に入り',
  opened: '最近使った資料',
};

const toggleInSet = <T,>(set: Set<T>, id: T) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

// 教材管理画面のルート。サイドバー・タブ・一覧・右パネルの状態をまとめて持つ
export function MaterialsApp() {
  const { materials, loading, error: loadError, loadedAt, reload, patchLocal } = useMaterials();
  const { folders, reload: reloadFolders } = useFolders();
  const { bundles, reload: reloadBundles } = useBundles();
  const [preferences, setPreferences] = usePreferences();

  const [filters, setFilters] = useState<ViewFilters>(initialFilters);
  const [sortOrder, setSortOrder] = useState<SortOrder>('updated_desc');
  const [density, setDensity] = useState<Density>('comfortable');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState>(null);
  const [bundleDialog, setBundleDialog] = useState<BundleDialogState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // スマホ表示でサイドバーを重ねて開いているか（PC の折りたたみは preferences に保存）
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // サイドバーのツリーで開いているフォルダ／一覧のトグルで開いているフォルダ
  const [sidebarExpanded, setSidebarExpanded] = useState<Set<number>>(new Set());
  const [tableExpanded, setTableExpanded] = useState<Set<number>>(new Set());
  // 一覧で開いているまとめ
  const [expandedBundles, setExpandedBundles] = useState<Set<number>>(new Set());
  // 閉じている区切り見出し（例：folder:12）
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // 画面にファイルをドラッグ中か／一括登録するファイル
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState<File[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // その場で名前を変更中のフォルダ。サイドバーと一覧の両方に同じフォルダがあるため、どちらで始めたかも持つ
  const [renaming, setRenaming] = useState<{ id: number; place: FolderPlace } | null>(null);
  // フォルダの右クリックメニュー
  const [folderMenu, setFolderMenu] = useState<{
    folder: Folder;
    place: FolderPlace;
    x: number;
    y: number;
  } | null>(null);
  // 教材の右クリックメニュー（対象は ID で持ち、更新後の内容で表示し直す）
  const [materialMenu, setMaterialMenu] = useState<{ ids: number[]; x: number; y: number } | null>(
    null,
  );
  // その場で名前を変更中の教材
  const [renamingMaterialId, setRenamingMaterialId] = useState<number | null>(null);
  // 画面全体のビューアで開いている教材
  const [viewerId, setViewerId] = useState<number | null>(null);
  // カーソルを合わせている行（添付ファイルのプレビュー）
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const canHover = useCanHover();
  // 一覧の幅（狭いときは選んだ列数より少なくして、1列あたりの幅を保つ）
  const mainRef = useRef<HTMLElement>(null);
  const [mainWidth, setMainWidth] = useState(0);
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setMainWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const listColumns = Math.max(
    1,
    Math.min(preferences.listColumns, Math.floor(mainWidth / MIN_COLUMN_WIDTH)),
  ) as ListColumns;

  // 通知は数秒で自動的に消す
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const folderIndex = useMemo(() => buildFolderIndex(folders), [folders]);
  const bundleMap = useMemo(() => new Map(bundles.map((b) => [b.id, b])), [bundles]);
  const currentFolder =
    filters.scope.kind === 'folder' ? folderIndex.byId.get(filters.scope.id) : undefined;
  const breadcrumb = currentFolder ? folderPath(folderIndex, currentFolder.id) : [];

  const context = useMemo<ViewContext>(
    () => ({
      now: loadedAt,
      scopeFolderIds:
        filters.scope.kind === 'folder' ? subtreeIds(folderIndex, filters.scope.id) : undefined,
      bundleNames: new Map(bundles.map((b) => [b.id, b.name])),
      folderPaths: new Map(
        [...folderIndex.byId.keys()].map((id) => [
          id,
          folderPath(folderIndex, id)
            .map((f) => f.name)
            .join(' › '),
        ]),
      ),
    }),
    [loadedAt, filters.scope, folderIndex, bundles],
  );

  const tabBase = useMemo(
    () => filterMaterials(materials, filters, context, { ignoreType: true }),
    [materials, filters, context],
  );
  const filtered = useMemo(
    () => filterMaterials(tabBase, filters, context),
    [tabBase, filters, context],
  );
  const typeCounts = useMemo(() => countByType(tabBase), [tabBase]);

  // 資料マップは今いる場所の中身をフォルダごとに示す（検索語・タグだけ反映し、範囲と種類は外す）
  const mapMaterials = useMemo(
    () => filterMaterials(materials, { ...filters, scope: { kind: 'all' }, type: 'all' }, context),
    [materials, filters, context],
  );

  const hasFilters = Boolean(filters.type !== 'all' || filters.tag || filters.query.trim());

  // フォルダを開いているときはサブフォルダをトグルリストで、それ以外は教材を平らに並べる
  // どちらの場合も、同じまとめに入っている教材は1行に束ねる
  const rows = useMemo<TableRow[]>(() => {
    const scope = filters.scope;
    if (scope.kind === 'folder' && folderIndex.byId.has(scope.id)) {
      return buildFolderRows({
        rootId: scope.id,
        index: folderIndex,
        materials: filtered,
        sortOrder,
        expanded: tableExpanded,
        bundles: bundleMap,
        expandedBundles,
        hideEmptyFolders: hasFilters,
      });
    }
    // 「最近使った資料」は、選んだ並び・区切りに関係なく開いた順に並べる
    const opened = scope.kind === 'opened';
    return buildGroupedRows({
      materials: filtered,
      groupBy: opened ? 'none' : preferences.groupBy,
      sortOrder: opened ? 'opened_desc' : sortOrder,
      bundles: bundleMap,
      expandedBundles,
      collapsedGroups,
      folderIndex,
    });
  }, [
    filters.scope,
    folderIndex,
    filtered,
    sortOrder,
    tableExpanded,
    bundleMap,
    expandedBundles,
    collapsedGroups,
    preferences.groupBy,
    hasFilters,
  ]);
  // 一覧に出ている教材（閉じたまとめ・区切りの中身も含む）
  const displayedMaterials = useMemo(() => {
    const filteredById = new Map(filtered.map((m) => [m.id, m]));
    const byId = new Map<number, Material>();
    for (const row of rows) {
      if (row.kind === 'material') byId.set(row.material.id, row.material);
      if (row.kind === 'bundle') for (const m of row.members) byId.set(m.id, m);
      if (row.kind === 'group') {
        for (const id of row.ids) {
          const m = filteredById.get(id);
          if (m) byId.set(id, m);
        }
      }
    }
    return [...byId.values()];
  }, [rows, filtered]);

  // 表示中の教材のうち選択されているもの（閉じたフォルダや絞り込みで隠れた行は操作対象にしない）
  const selectedVisible = useMemo(
    () => new Set(displayedMaterials.filter((m) => selectedIds.has(m.id)).map((m) => m.id)),
    [displayedMaterials, selectedIds],
  );

  const tagSuggestions = useMemo(
    () => [
      ...new Set([
        ...countValues(materials.flatMap((m) => m.tags)).map((t) => t.name),
        ...PRESET_TAGS,
      ]),
    ],
    [materials],
  );

  const panelMaterial =
    panel && panel.mode !== 'create'
      ? materials.find((m) => m.id === panel.id) ?? null
      : null;

  function updateFilters(patch: Partial<ViewFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setSelectedIds(new Set());
  }

  // フォルダを開く（サイドバーのツリーも親までたどって展開する）
  function openFolder(id: number, patch: Partial<ViewFilters> = {}) {
    updateFilters({ scope: { kind: 'folder', id }, ...patch });
    const ancestors = folderPath(folderIndex, id).slice(0, -1);
    setSidebarExpanded((current) => new Set([...current, ...ancestors.map((f) => f.id)]));
  }

  // 新規登録の初期値：表示中のフォルダ・種類タブを引き継ぐ
  const createDefaults: Pick<MaterialFormValues, 'material_type' | 'folder_id'> = {
    folder_id: currentFolder ? String(currentFolder.id) : '',
    material_type: filters.type !== 'all' ? filters.type : 'slide',
  };
  const overlayOpen = Boolean(
    panel || folderDialog || bundleDialog || settingsOpen || queuedFiles || viewerId !== null,
  );

  // キー操作：「/」で検索欄へ、「N」で新規登録（入力中やダイアログ表示中は無効）
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const typing =
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (typing || overlayOpen || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === '/') {
        event.preventDefault();
        document.getElementById(SEARCH_INPUT_ID)?.focus();
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        setPanel({ mode: 'create' });
      } else if (event.key === ' ' && selectedVisible.size === 1) {
        // 選択中の教材1件をビューアで開く
        const target = materials.find((m) => selectedVisible.has(m.id));
        if (target?.file_attached && target.file_url) {
          event.preventDefault();
          openViewer(target);
        }
      } else if ((event.key === 'f' || event.key === 'F') && selectedVisible.size > 0) {
        // 選択中の教材をお気に入りに入れる（すべてお気に入りなら外す）
        event.preventDefault();
        const targets = materials.filter((m) => selectedVisible.has(m.id));
        void handleToggleFavorite(targets);
      } else if (event.key === 'F2' && selectedVisible.size === 1) {
        // 選択中の教材1件の名前をその場で変更
        event.preventDefault();
        setRenamingMaterialId([...selectedVisible][0]);
      } else if (event.key === 'Backspace' && currentFolder) {
        // 1つ上のフォルダへ（最上位なら「すべての教材」へ）
        event.preventDefault();
        const parentId = currentFolder.parent_id;
        setFilters((current) => ({
          ...current,
          scope: parentId !== null ? { kind: 'folder', id: parentId } : { kind: 'all' },
        }));
        setSelectedIds(new Set());
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // handleToggleFavorite は materials から作るため、materials が変わったら付け直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayOpen, currentFolder, selectedVisible, materials]);

  // ブラウザのタブにも現在地を出す
  const locationName = currentFolder
    ? currentFolder.name
    : filters.scope.kind === 'folder'
      ? 'フォルダ'
      : scopeLabels[filters.scope.kind];
  useEffect(() => {
    document.title = `${locationName} - MaterialOrg`;
  }, [locationName]);

  // 画面全体へのファイルのドロップで登録（行のドラッグ移動や、入力欄へのドロップとは区別する）
  useEffect(() => {
    let depth = 0;
    const isFileDrag = (event: DragEvent) =>
      Boolean(event.dataTransfer?.types.includes('Files')) &&
      !event.dataTransfer?.types.includes(DRAG_TYPE);

    function onDragEnter(event: DragEvent) {
      if (!isFileDrag(event) || overlayOpen) return;
      depth += 1;
      setDraggingFiles(true);
    }
    function onDragLeave(event: DragEvent) {
      if (!isFileDrag(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDraggingFiles(false);
    }
    function onDragOver(event: DragEvent) {
      // 既定の動作（ブラウザでファイルを開く）を止める
      if (isFileDrag(event)) event.preventDefault();
    }
    function onDrop(event: DragEvent) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      depth = 0;
      setDraggingFiles(false);
      // 登録パネルのファイル欄など、中の要素が受け取ったドロップは扱わない
      if (overlayOpen) return;

      const files = [...(event.dataTransfer?.files ?? [])];
      if (files.length === 1) setPanel({ mode: 'create', file: files[0] });
      else if (files.length > 1) setQueuedFiles(files);
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [overlayOpen]);

  const closePanel = useCallback(() => setPanel(null), []);
  const closeQueue = useCallback(() => setQueuedFiles(null), []);
  const closeFolderDialog = useCallback(() => setFolderDialog(null), []);
  const closeBundleDialog = useCallback(() => setBundleDialog(null), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // PC では折りたたみを戻し、スマホでは重ねて開く
  function showSidebar() {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setPreferences({ sidebarCollapsed: false });
    } else {
      setSidebarOpen(true);
    }
  }

  function toggleSelectAll() {
    const allSelected =
      displayedMaterials.length > 0 && selectedVisible.size === displayedMaterials.length;
    setSelectedIds(allSelected ? new Set() : new Set(displayedMaterials.map((m) => m.id)));
  }

  function selectMany(ids: number[], selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (selected) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  // 教材・フォルダ・まとめをまとめて再取得する（件数がすべてに関係するため）
  async function reloadAll() {
    await Promise.all([reload(), reloadFolders(), reloadBundles()]);
  }

  function showError(err: unknown) {
    setNotice({
      type: 'error',
      text: err instanceof Error ? err.message : '予期しないエラーが発生しました。',
    });
  }

  async function handleMove(ids: number[], folderId: number | null) {
    setBusy(true);
    try {
      const { moved } = await moveMaterials(ids, folderId);
      const name = folderId === null ? '未分類' : folderIndex.byId.get(folderId)?.name;
      setNotice({ type: 'success', text: `${moved}件を「${name}」へ移動しました。` });
      setSelectedIds(new Set());
      await reloadAll();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(targets: Material[]) {
    const message =
      targets.length === 1
        ? `「${targets[0].title}」を削除しますか？\nこの操作は取り消せません。`
        : `選択した${targets.length}件の教材を削除しますか？\nこの操作は取り消せません。`;
    if (!window.confirm(message)) return;

    setBusy(true);
    try {
      for (const material of targets) await deleteMaterial(material.id);
      setNotice({ type: 'success', text: `${targets.length}件の教材を削除しました。` });
      setSelectedIds(new Set());
      if (panel && panel.mode !== 'create' && targets.some((m) => m.id === panel.id)) {
        setPanel(null);
      }
    } catch (err) {
      showError(err);
    } finally {
      // 途中で失敗しても、削除できた分を反映する
      await reloadAll();
      setBusy(false);
    }
  }

  async function handleSaved(message: string) {
    setPanel(null);
    setNotice({ type: 'success', text: message });
    await reloadAll();
  }

  async function handleFolderSaved(message: string, saved: Folder | null) {
    const editing = folderDialog?.folder ?? null;
    setFolderDialog(null);
    setNotice({ type: 'success', text: message });

    if (saved && !editing) {
      if (saved.parent_id === null) {
        // 最上位に作ったフォルダはそのまま開く
        updateFilters({ scope: { kind: 'folder', id: saved.id } });
      } else {
        // サブフォルダは親をサイドバーと一覧の両方で展開して見えるようにする
        const parentId = saved.parent_id;
        const ancestors = folderPath(folderIndex, parentId).map((f) => f.id);
        setSidebarExpanded((current) => new Set([...current, ...ancestors]));
        setTableExpanded((current) => new Set([...current, parentId]));
      }
    } else if (!saved && editing && currentFolder?.id === editing.id) {
      // 表示中のフォルダを削除したら親フォルダ（最上位なら「すべて」）に戻る
      updateFilters({
        scope:
          editing.parent_id !== null
            ? { kind: 'folder', id: editing.parent_id }
            : { kind: 'all' },
      });
    }

    await Promise.all([reloadFolders(), saved ? Promise.resolve() : reload()]);
  }

  // 選択した教材を既存のまとめに入れる／まとめから外す（bundleId が null）
  async function handleAssignBundle(ids: number[], bundleId: number | null) {
    setBusy(true);
    try {
      const { updated } = await assignBundle(ids, bundleId);
      const name = bundleId !== null ? bundleMap.get(bundleId)?.name : undefined;
      setNotice({
        type: 'success',
        text: name ? `${updated}件を「${name}」に追加しました。` : `${updated}件をまとめから外しました。`,
      });
      setSelectedIds(new Set());
      if (bundleId !== null) setExpandedBundles((current) => new Set([...current, bundleId]));
      await reloadAll();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleBundleDone(message: string) {
    setBundleDialog(null);
    setSelectedIds(new Set());
    setNotice({ type: 'success', text: message });
    await reloadAll();
  }

  async function handleRenameFolder(folder: Folder, name: string) {
    setRenaming(null);
    try {
      await saveFolder({ name, color: folder.color, parent_id: folder.parent_id }, folder.id);
      setNotice({ type: 'success', text: `フォルダ名を「${name}」に変更しました。` });
      await reloadFolders();
    } catch (err) {
      showError(err);
    }
  }

  const closeFolderMenu = useCallback(() => setFolderMenu(null), []);
  const closeMaterialMenu = useCallback(() => setMaterialMenu(null), []);
  const toggleSidebarFolder = useCallback(
    (id: number) => setSidebarExpanded((current) => toggleInSet(current, id)),
    [],
  );

  async function handleFolderColor(folder: Folder, color: FolderColor) {
    try {
      await saveFolder({ name: folder.name, color, parent_id: folder.parent_id }, folder.id);
      setNotice({
        type: 'success',
        text: `「${folder.name}」の色を${folderColorLabels[color]}にしました。`,
      });
      await reloadFolders();
    } catch (err) {
      showError(err);
    }
  }

  // フォルダをドラッグして並び替え・別のフォルダの中へ移動
  async function handleArrangeFolder(folderId: number, plan: FolderDropPlan) {
    const folder = folderIndex.byId.get(folderId);
    if (!folder) return;
    setBusy(true);
    try {
      await arrangeFolders(plan.parentId, plan.folderIds);
      if (plan.parentId !== folder.parent_id) {
        const parentName =
          plan.parentId === null ? '最上位' : `「${folderIndex.byId.get(plan.parentId)?.name}」の中`;
        setNotice({ type: 'success', text: `「${folder.name}」を${parentName}へ移動しました。` });
        // 移した先が見えるよう、親をサイドバーと一覧の両方で開く
        if (plan.parentId !== null) {
          const ancestors = folderPath(folderIndex, plan.parentId).map((f) => f.id);
          setSidebarExpanded((current) => new Set([...current, ...ancestors]));
          setTableExpanded((current) => new Set([...current, plan.parentId as number]));
        }
      } else {
        setNotice({ type: 'success', text: `「${folder.name}」の並び順を変更しました。` });
      }
      await reloadFolders();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  }

  // 詳細を開く（「最近使った資料」に記録する。記録に失敗しても開くことは妨げない）
  function openDetail(material: Material) {
    setPanel({ mode: 'detail', id: material.id });
    recordOpened(material);
  }

  function recordOpened(material: Material) {
    patchLocal([material.id], { last_opened_at: new Date().toISOString() });
    markOpened(material.id).catch(() => {});
  }

  // 添付ファイルを画面全体のビューアで開く
  function openViewer(material: Material) {
    if (!material.file_attached || !material.file_url) return;
    setHover(null);
    setViewerId(material.id);
    recordOpened(material);
  }

  // お気に入りに入れる／外す（対象がすべてお気に入りなら外す）。先に画面へ反映してから保存する
  async function handleToggleFavorite(targets: Material[]) {
    if (targets.length === 0) return;
    const favorite = !targets.every((m) => m.favorited_at);
    const ids = targets.map((m) => m.id);
    const label = targets.length === 1 ? `「${targets[0].title}」` : `${targets.length}件`;
    patchLocal(
      ids.filter((id) => favorite !== Boolean(materials.find((m) => m.id === id)?.favorited_at)),
      { favorited_at: favorite ? new Date().toISOString() : null },
    );
    try {
      await setFavorite(ids, favorite);
      setNotice({
        type: 'success',
        text: favorite ? `${label}をお気に入りに追加しました。` : `${label}をお気に入りから外しました。`,
      });
    } catch (err) {
      showError(err);
      await reload();
    }
  }

  async function handleRenameMaterial(material: Material, title: string) {
    setRenamingMaterialId(null);
    try {
      await updateMaterialFields(material, { title });
      setNotice({ type: 'success', text: `教材名を「${title}」に変更しました。` });
      await reload();
    } catch (err) {
      showError(err);
    }
  }

  // 右クリックメニューからの簡易編集（複数件は順に更新する）
  async function handleQuickUpdate(
    targets: Material[],
    patch: (m: Material) => Parameters<typeof updateMaterialFields>[1],
    message: string,
  ) {
    setBusy(true);
    try {
      for (const material of targets) await updateMaterialFields(material, patch(material));
      setNotice({ type: 'success', text: message });
    } catch (err) {
      showError(err);
    } finally {
      await reload();
      setBusy(false);
    }
  }

  function openMaterialMenu(material: Material, x: number, y: number) {
    // 右クリックした行が選択中なら、選択中の教材すべてが対象
    const ids =
      selectedVisible.has(material.id) && selectedVisible.size > 1
        ? [...selectedVisible]
        : [material.id];
    setMaterialMenu({ ids, x, y });
  }

  function materialMenuItems(targets: Material[]): ContextMenuItem[] {
    const single = targets.length === 1 ? targets[0] : null;
    const label = single ? `「${single.title}」` : `${targets.length}件`;
    const ids = targets.map((m) => m.id);
    const tags = [
      ...new Set([...PRESET_TAGS, ...countValues(materials.flatMap((m) => m.tags)).map((t) => t.name)]),
    ];
    const sameFolder = (id: number | null) => targets.every((m) => m.folder_id === id);
    const sortedBundles = [...bundles].sort(compareBundleNames);

    return [
      {
        label: 'ビューアで開く',
        hint: 'Space',
        disabled: !single?.file_attached,
        onSelect: () => single && openViewer(single),
      },
      {
        label: '詳細を開く',
        disabled: !single,
        onSelect: () => single && openDetail(single),
      },
      {
        label: targets.every((m) => m.favorited_at) ? 'お気に入りから外す' : 'お気に入りに追加',
        hint: 'F',
        onSelect: () => void handleToggleFavorite(targets),
      },
      {
        label: '名前を変更',
        hint: 'F2',
        disabled: !single,
        onSelect: () => single && setRenamingMaterialId(single.id),
      },
      {
        label: '種類',
        separator: true,
        submenu: MATERIAL_TYPES.map((type) => ({
          label: typeLabels[type],
          checked: targets.every((m) => m.material_type === type),
          onSelect: () =>
            void handleQuickUpdate(
              targets.filter((m) => m.material_type !== type),
              () => ({ material_type: type }),
              `${label}の種類を「${typeLabels[type]}」にしました。`,
            ),
        })),
      },
      {
        label: 'フォルダへ移動',
        submenu: [
          {
            label: '未分類',
            checked: sameFolder(null),
            onSelect: () => void handleMove(ids, null),
          },
          ...flattenFolders(folderIndex).map(({ folder, depth }) => ({
            label: indentedName(folder.name, depth),
            checked: sameFolder(folder.id),
            onSelect: () => void handleMove(ids, folder.id),
          })),
        ],
      },
      {
        label: 'タグ',
        submenu: tags.map((tag) => {
          const all = targets.every((m) => m.tags.includes(tag));
          return {
            label: `#${tag}`,
            checked: all,
            keepOpen: true,
            onSelect: () =>
              void handleQuickUpdate(
                all ? targets : targets.filter((m) => !m.tags.includes(tag)),
                (m) => ({ tags: all ? m.tags.filter((t) => t !== tag) : [...m.tags, tag] }),
                all ? `${label}からタグ「${tag}」を外しました。` : `${label}にタグ「${tag}」を付けました。`,
              ),
          };
        }),
      },
      {
        label: 'まとめ',
        submenu: [
          {
            label: '新しくまとめる…',
            onSelect: () => setBundleDialog({ bundle: null, materials: targets }),
          },
          {
            label: 'まとめから外す',
            disabled: targets.every((m) => m.bundle_id === null),
            onSelect: () => void handleAssignBundle(ids, null),
          },
          ...sortedBundles.map((bundle, i) => ({
            label: `「${bundle.name}」に追加`,
            separator: i === 0,
            checked: targets.every((m) => m.bundle_id === bundle.id),
            onSelect: () => void handleAssignBundle(ids, bundle.id),
          })),
        ],
      },
      {
        label: '詳しく編集…',
        separator: true,
        disabled: !single,
        onSelect: () => single && setPanel({ mode: 'edit', id: single.id }),
      },
      {
        label: '削除…',
        danger: true,
        onSelect: () => void handleDelete(targets),
      },
    ];
  }

  // 教材を別の教材に重ねたとき：
  // before/after＝まとめの中での並び替え、bundle＝相手のまとめに追加（相手がまとめに入っていなければ新しくまとめる）
  async function handleDropOnMaterial(ids: number[], target: Material, mode: MaterialDropMode) {
    if (mode !== 'bundle') {
      if (target.bundle_id === null || ids.length !== 1) return;
      const bundleId = target.bundle_id;
      const order = sortBundleMembers(materials.filter((m) => m.bundle_id === bundleId)).map(
        (m) => m.id,
      );
      const next = moveInOrder(order, ids[0], target.id, mode === 'after');
      if (next.every((id, i) => id === order[i])) return;
      setBusy(true);
      try {
        await reorderBundle(bundleId, next);
        await reloadAll();
      } catch (err) {
        showError(err);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (target.bundle_id !== null) {
      await handleAssignBundle(ids, target.bundle_id);
      return;
    }
    const dragged = ids
      .filter((id) => id !== target.id)
      .map((id) => materials.find((m) => m.id === id))
      .filter((m): m is Material => m !== undefined);
    if (dragged.length === 0) return;
    // 重ねた相手を先頭に、まとめの名前と順番を確認してから作る
    setBundleDialog({ bundle: null, materials: [target, ...dragged] });
  }

  function openBundleEditor(bundle: Bundle) {
    setBundleDialog({ bundle, materials: materials.filter((m) => m.bundle_id === bundle.id) });
  }

  function handleMapNavigate(target: MapTarget, type: MaterialType | 'all') {
    if (target.kind === 'folder') openFolder(target.id, { type });
    else if (target.kind === 'unfiled') updateFilters({ scope: { kind: 'unfiled' }, type });
    else if (target.kind === 'all') updateFilters({ scope: { kind: 'all' }, type });
    else updateFilters({ type: filters.type === type ? 'all' : type });
  }

  // フォルダ列に出す名前：今いるフォルダの中なら、そこからの道筋だけにする
  function folderLabel(folderId: number | null) {
    if (folderId === null || !folderIndex.byId.has(folderId)) return '未分類';
    const path = folderPath(folderIndex, folderId);
    if (currentFolder) {
      const index = path.findIndex((f) => f.id === currentFolder.id);
      if (folderId === currentFolder.id) return 'このフォルダ';
      if (index >= 0) return path.slice(index + 1).map((f) => f.name).join(' › ');
    }
    return path.map((f) => f.name).join(' › ');
  }

  function handleTagClick(tag: string) {
    updateFilters({ tag: filters.tag === tag ? null : tag });
    setPanel(null);
  }

  const canCreateSubfolder =
    !currentFolder || folderDepth(folderIndex, currentFolder.id) < MAX_FOLDER_DEPTH;

  const locationColor = currentFolder
    ? folderColor(currentFolder.color)
    : filters.scope.kind === 'unfiled'
      ? folderColor(null)
      : null;

  // 現在地：すべての教材 › 親フォルダ › 今いるフォルダ（今いる段はフォルダの色で強調）
  const title = currentFolder ? (
    <nav aria-label="現在地" className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <button
        type="button"
        onClick={() => updateFilters({ scope: { kind: 'all' } })}
        // スマホでは「上の階層へ」で戻れるため、道筋は今いるフォルダだけを出す
        className="hidden shrink-0 text-sm font-bold text-muted hover:text-foreground hover:underline sm:inline"
      >
        すべての教材
      </button>
      {breadcrumb.map((folder, i) =>
        i < breadcrumb.length - 1 ? (
          <span key={folder.id} className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <span aria-hidden="true" className="text-muted">›</span>
            <button
              type="button"
              onClick={() => openFolder(folder.id)}
              className="flex min-w-0 items-center gap-1 text-sm font-bold text-muted hover:text-foreground hover:underline"
            >
              <FolderDot color={folder.color} />
              <span className="max-w-36 truncate">{folder.name}</span>
            </button>
          </span>
        ) : (
          <span key={folder.id} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden="true" className="hidden text-muted sm:inline">›</span>
            <span
              aria-current="location"
              className="flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5"
              style={{ background: folderTint(folder.color, 18) }}
            >
              <FolderIcon color={folder.color} open className="size-5" />
              <span className="truncate" style={{ color: folderColor(folder.color) }}>
                {folder.name}
              </span>
            </span>
          </span>
        ),
      )}
    </nav>
  ) : (
    locationName
  );

  // 件数：フォルダ表示ではサブフォルダ内も含めた数
  const countLabel =
    filtered.length !== tabBase.length || hasFilters
      ? `${filtered.length}件 / ${materials.length}件中`
      : `${filtered.length}件`;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        materials={materials}
        folderIndex={folderIndex}
        filters={filters}
        now={loadedAt}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={preferences.sidebarCollapsed && !sidebarOpen}
        onCollapse={() => setPreferences({ sidebarCollapsed: true })}
        onExpand={() => setPreferences({ sidebarCollapsed: false })}
        expandedFolders={sidebarExpanded}
        onToggleFolderExpand={toggleSidebarFolder}
        onScopeChange={(scope) =>
          scope.kind === 'folder' ? openFolder(scope.id) : updateFilters({ scope })
        }
        onTagToggle={(tag) => updateFilters({ tag: filters.tag === tag ? null : tag })}
        onAddMaterial={() => {
          setSidebarOpen(false);
          setPanel({ mode: 'create' });
        }}
        onCreateFolder={(parentId) => setFolderDialog({ folder: null, parentId })}
        onEditFolder={(folder) => setFolderDialog({ folder, parentId: folder.parent_id })}
        renamingFolderId={renaming?.place === 'sidebar' ? renaming.id : null}
        onStartRename={(folder) => setRenaming({ id: folder.id, place: 'sidebar' })}
        onRename={(folder, name) => void handleRenameFolder(folder, name)}
        onCancelRename={() => setRenaming(null)}
        onFolderContextMenu={(folder, x, y) => setFolderMenu({ folder, place: 'sidebar', x, y })}
        onArrangeFolder={(folderId, plan) => void handleArrangeFolder(folderId, plan)}
        onDropToFolder={(ids, folderId) => void handleMove(ids, folderId)}
        onDropToFavorites={(ids) =>
          void handleToggleFavorite(
            materials.filter((m) => ids.includes(m.id) && !m.favorited_at),
          )
        }
        onOpenSettings={() => {
          setSidebarOpen(false);
          setSettingsOpen(true);
        }}
        activeMaterialId={panel?.mode === 'detail' ? panel.id : null}
        onOpenMaterial={(material) => {
          setSidebarOpen(false);
          openDetail(material);
        }}
        onOpenViewer={(material) => {
          setSidebarOpen(false);
          openViewer(material);
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="shrink-0 border-b border-border bg-surface px-4 pt-4 sm:px-6"
          // 上端の色帯：今いるフォルダの色（フォルダ外では出さない）
          style={locationColor ? { boxShadow: `inset 0 4px 0 ${locationColor}` } : undefined}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={showSidebar}
              aria-label="サイドバーを開く"
              title="サイドバーを開く"
              // PC 幅では畳んでも簡易表示（アイコンの帯）が残るため、スマホ幅でだけ出す
              className="rounded-md p-1.5 text-muted hover:bg-surface-muted lg:hidden"
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-5">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            {currentFolder && (
              <button
                type="button"
                onClick={() =>
                  currentFolder.parent_id !== null
                    ? openFolder(currentFolder.parent_id)
                    : updateFilters({ scope: { kind: 'all' } })
                }
                aria-label="上の階層へ"
                title="上の階層へ（Backspace キー）"
                aria-keyshortcuts="Backspace"
                className="shrink-0 rounded-md border border-border p-1 text-muted hover:border-foreground hover:text-foreground"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
                  <path
                    d="M8 13V3M3.5 7.5 8 3l4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
            )}
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-2 text-lg font-bold">
              {title}
              <span className="shrink-0 text-sm font-normal text-muted tabular-nums">
                {countLabel}
              </span>
            </h1>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {/* スマホではサイドバーから作成できるため、狭い画面では隠す */}
              {canCreateSubfolder && (
                <span className="hidden sm:block">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setFolderDialog({ folder: null, parentId: currentFolder?.id ?? null })
                    }
                    className="py-1.5"
                    title={currentFolder ? 'このフォルダの中にフォルダを作成' : 'フォルダを作成'}
                  >
                    ＋ フォルダ
                  </Button>
                </span>
              )}
              <Button
                onClick={() => setPanel({ mode: 'create' })}
                className="py-1.5"
                title="教材を登録（N キー）。ファイルを画面にドロップしても登録できます"
                aria-keyshortcuts="n"
              >
                ＋ 教材
              </Button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="表示設定"
                title="表示設定（テーマ・色）"
                className="rounded-md p-1.5 text-muted hover:bg-surface-muted"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-5">
                  <path
                    d="M2 4.5h7m3 0h2M2 11.5h2m3 0h7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <circle cx="10.5" cy="4.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="5.5" cy="11.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </div>

          {filters.tag && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">絞り込み：</span>
              {filters.tag && (
                <button
                  type="button"
                  onClick={() => updateFilters({ tag: null })}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 hover:border-foreground"
                >
                  #{filters.tag}
                  <span aria-hidden="true" className="text-muted">×</span>
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            <SearchBox query={filters.query} onQueryChange={(query) => updateFilters({ query })} />
          </div>

          {!preferences.mapCollapsed && mapMaterials.length > 0 && (
            <div className="mt-3">
              <ShelfMap
                materials={mapMaterials}
                folderIndex={folderIndex}
                currentFolderId={currentFolder?.id ?? null}
                activeType={filters.type}
                onNavigate={handleMapNavigate}
                onDropToFolder={(ids, folderId) => void handleMove(ids, folderId)}
              />
            </div>
          )}

          <div className="mt-3">
            <Toolbar
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              groupBy={preferences.groupBy}
              onGroupByChange={(groupBy) => setPreferences({ groupBy })}
              groupByDisabled={Boolean(currentFolder) || filters.scope.kind === 'opened'}
              sortDisabled={filters.scope.kind === 'opened'}
              density={density}
              onDensityChange={setDensity}
              mapVisible={!preferences.mapCollapsed}
              onToggleMap={() => setPreferences({ mapCollapsed: !preferences.mapCollapsed })}
              listColumns={preferences.listColumns}
              onListColumnsChange={(listColumns) => setPreferences({ listColumns })}
            />
          </div>

          <div className="mt-2">
            <TypeTabs
              value={filters.type}
              counts={typeCounts}
              total={tabBase.length}
              onChange={(type) => updateFilters({ type })}
            />
          </div>
        </header>

        <main ref={mainRef} className="min-h-0 flex-1 overflow-auto bg-surface">
          {loadError ? (
            <p role="alert" className="m-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
              {loadError}
            </p>
          ) : loading ? (
            <p className="p-10 text-center text-sm text-muted">教材を読み込んでいます...</p>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted">
              {materials.length === 0 ? (
                <>
                  <p>まだ教材が登録されていません。</p>
                  <p className="mt-1">ファイルをこの画面にドロップするか、ボタンから登録してください。</p>
                  <Button className="mt-4" onClick={() => setPanel({ mode: 'create' })}>
                    ＋ 教材を登録
                  </Button>
                </>
              ) : currentFolder && !hasFilters ? (
                <p>このフォルダは空です。教材の行をここ（サイドバーのフォルダ）へドラッグして移動できます。</p>
              ) : (
                <>
                  <p>条件に一致する教材はありません。</p>
                  {hasFilters && (
                    <Button
                      variant="secondary"
                      className="mt-4"
                      onClick={() =>
                        updateFilters({ type: 'all', tag: null, query: '' })
                      }
                    >
                      絞り込みを解除
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            (() => {
              // 2列・3列のときは行の並びを上から順に列へ分け、列ごとに同じ表を並べる
              const renderTable = (tableRows: TableRow[], onToggleSelectAll: () => void) => (
                <MaterialTable
                  rows={tableRows}
                  onToggleSelectAll={onToggleSelectAll}
                  folders={folderIndex.byId}
                  folderLabel={folderLabel}
                  density={density}
                  now={loadedAt}
                  selectedIds={selectedVisible}
                  activeId={panel && panel.mode !== 'create' ? panel.id : null}
                  onToggleSelect={(id) => setSelectedIds((current) => toggleInSet(current, id))}
                  onOpen={openDetail}
                  onOpenViewer={openViewer}
                  onToggleFavorite={(material) => void handleToggleFavorite([material])}
                  onEdit={(material) => setPanel({ mode: 'edit', id: material.id })}
                  onDelete={(material) => void handleDelete([material])}
                  onTagClick={handleTagClick}
                  onToggleFolder={(id) => setTableExpanded((current) => toggleInSet(current, id))}
                  onOpenFolder={openFolder}
                  onDropToFolder={(ids, folderId) => void handleMove(ids, folderId)}
                  onToggleBundle={(id) => setExpandedBundles((current) => toggleInSet(current, id))}
                  onEditBundle={openBundleEditor}
                  onToggleGroup={(key) => setCollapsedGroups((current) => toggleInSet(current, key))}
                  onDropOnMaterial={(ids, target, mode) => void handleDropOnMaterial(ids, target, mode)}
                  onDropIntoBundle={(ids, bundleId) => void handleAssignBundle(ids, bundleId)}
                  renamingFolderId={renaming?.place === 'table' ? renaming.id : null}
                  onRename={(folder, name) => void handleRenameFolder(folder, name)}
                  onCancelRename={() => setRenaming(null)}
                  onFolderContextMenu={(folder, x, y) => setFolderMenu({ folder, place: 'table', x, y })}
                  onMaterialContextMenu={openMaterialMenu}
                  renamingMaterialId={renamingMaterialId}
                  onRenameMaterial={(material, title) => void handleRenameMaterial(material, title)}
                  onCancelRenameMaterial={() => setRenamingMaterialId(null)}
                  onSelectMany={selectMany}
                  onHoverPreview={setHover}
                />
              );
              if (listColumns === 1) return renderTable(rows, toggleSelectAll);
              return (
                <div
                  className="grid divide-x divide-border"
                  style={{ gridTemplateColumns: `repeat(${listColumns}, minmax(0, 1fr))` }}
                >
                  {splitRows(rows, listColumns).map((chunk, i) => {
                    const ids = [...selectableIdsOf(chunk)];
                    const allSelected = ids.length > 0 && ids.every((id) => selectedVisible.has(id));
                    return (
                      <div key={i} className="min-w-0">
                        {renderTable(chunk, () => selectMany(ids, !allSelected))}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </main>

        {selectedVisible.size > 0 && (
          <BulkActionBar
            count={selectedVisible.size}
            folderIndex={folderIndex}
            bundles={bundles}
            hasBundled={displayedMaterials.some(
              (m) => selectedVisible.has(m.id) && m.bundle_id !== null,
            )}
            busy={busy}
            onMove={(folderId) => void handleMove([...selectedVisible], folderId)}
            onBundle={() =>
              setBundleDialog({
                bundle: null,
                materials: displayedMaterials.filter((m) => selectedVisible.has(m.id)),
              })
            }
            onAddToBundle={(bundleId) => void handleAssignBundle([...selectedVisible], bundleId)}
            onRemoveFromBundle={() => void handleAssignBundle([...selectedVisible], null)}
            onDelete={() =>
              void handleDelete(displayedMaterials.filter((m) => selectedVisible.has(m.id)))
            }
            onClear={() => setSelectedIds(new Set())}
          />
        )}
      </div>

      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`fixed right-4 bottom-4 z-[60] flex max-w-sm items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
            notice.type === 'error'
              ? 'bg-danger text-white'
              : 'bg-foreground text-background'
          }`}
        >
          {notice.text}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="通知を閉じる"
            className="text-lg leading-none opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {panel?.mode === 'create' && (
        <Drawer title="教材を登録" onClose={closePanel}>
          <MaterialForm
            material={null}
            defaults={{
              ...createDefaults,
              ...(panel.file && { title: titleFromFileName(panel.file.name) }),
            }}
            initialFile={panel.file}
            folderIndex={folderIndex}
            tagSuggestions={tagSuggestions}
            onSaved={handleSaved}
            onCancel={closePanel}
          />
        </Drawer>
      )}

      {panel?.mode === 'edit' && panelMaterial && (
        <Drawer title="教材を編集" onClose={closePanel}>
          <MaterialForm
            key={panelMaterial.id}
            material={panelMaterial}
            defaults={{}}
            folderIndex={folderIndex}
            tagSuggestions={tagSuggestions}
            onSaved={handleSaved}
            onCancel={() => setPanel({ mode: 'detail', id: panelMaterial.id })}
          />
        </Drawer>
      )}

      {panel?.mode === 'detail' && panelMaterial && (
        <Drawer title="教材の詳細" onClose={closePanel}>
          <MaterialDetail
            material={panelMaterial}
            folderPath={
              panelMaterial.folder_id !== null
                ? folderPath(folderIndex, panelMaterial.folder_id)
                : []
            }
            bundle={
              panelMaterial.bundle_id !== null ? bundleMap.get(panelMaterial.bundle_id) : undefined
            }
            onRemoveFromBundle={(material) => void handleAssignBundle([material.id], null)}
            onEdit={(material) => setPanel({ mode: 'edit', id: material.id })}
            onDelete={(material) => void handleDelete([material])}
            onTagClick={handleTagClick}
            onToggleFavorite={(material) => void handleToggleFavorite([material])}
            onOpenViewer={openViewer}
          />
        </Drawer>
      )}

      {folderDialog && (
        <FolderDialog
          folder={folderDialog.folder}
          defaultParentId={folderDialog.parentId}
          folderIndex={folderIndex}
          onClose={closeFolderDialog}
          onSaved={(message, saved) => void handleFolderSaved(message, saved)}
        />
      )}

      {bundleDialog && (
        <BundleDialog
          bundle={bundleDialog.bundle}
          materials={bundleDialog.materials}
          onClose={closeBundleDialog}
          onDone={(message) => void handleBundleDone(message)}
        />
      )}

      {folderMenu && (
        <ContextMenu
          x={folderMenu.x}
          y={folderMenu.y}
          title={folderMenu.folder.name}
          onClose={closeFolderMenu}
          items={[
            {
              label: '開く',
              onSelect: () => {
                setSidebarOpen(false);
                openFolder(folderMenu.folder.id);
              },
            },
            {
              label: '名前を変更',
              hint: 'F2',
              onSelect: () => setRenaming({ id: folderMenu.folder.id, place: folderMenu.place }),
            },
            {
              label: 'この中にフォルダを作成',
              disabled: folderDepth(folderIndex, folderMenu.folder.id) >= MAX_FOLDER_DEPTH,
              onSelect: () => setFolderDialog({ folder: null, parentId: folderMenu.folder.id }),
            },
            {
              label: '色',
              submenu: FOLDER_COLORS.map((color) => ({
                label: folderColorLabels[color],
                checked: folderMenu.folder.color === color,
                onSelect: () => void handleFolderColor(folderMenu.folder, color),
              })),
            },
            {
              label: '色・場所を変更…',
              onSelect: () =>
                setFolderDialog({ folder: folderMenu.folder, parentId: folderMenu.folder.parent_id }),
            },
            {
              label: '削除…',
              danger: true,
              onSelect: () =>
                setFolderDialog({ folder: folderMenu.folder, parentId: folderMenu.folder.parent_id }),
            },
          ]}
        />
      )}

      {materialMenu && (() => {
        const targets = materialMenu.ids
          .map((id) => materials.find((m) => m.id === id))
          .filter((m): m is Material => m !== undefined);
        if (targets.length === 0) return null;
        return (
          <ContextMenu
            x={materialMenu.x}
            y={materialMenu.y}
            title={targets.length === 1 ? targets[0].title : `選択中の${targets.length}件`}
            onClose={closeMaterialMenu}
            items={materialMenuItems(targets)}
          />
        );
      })()}

      {hover &&
        canHover &&
        !overlayOpen &&
        !folderMenu &&
        !materialMenu &&
        renamingMaterialId === null &&
        // 詳細パネルで開いている教材には出さない
        !(hover.target.kind === 'material' && panel && panel.mode !== 'create' && panel.id === hover.target.material.id) && (
          <HoverPreview
            key={
              hover.target.kind === 'material'
                ? `m-${hover.target.material.id}`
                : `b-${hover.target.bundle.id}`
            }
            target={hover.target}
            folders={folderIndex.byId}
            rowRect={hover.rowRect}
            pointerX={hover.pointerX}
          />
        )}

      {viewerId !== null &&
        (() => {
          // 前後の教材：一覧に今出ている、添付ありの教材（表示順）
          const list = displayedMaterials.filter((m) => m.file_attached && m.file_url);
          const index = list.findIndex((m) => m.id === viewerId);
          const material = list[index] ?? materials.find((m) => m.id === viewerId);
          if (!material) return null;
          const move = (to: number) => () => openViewer(list[to]);
          return (
            <Suspense fallback={<div className="fixed inset-0 z-[85] bg-surface" />}>
              <FileViewer
                material={material}
                folders={folderIndex.byId}
                position={{ index: Math.max(0, index), total: Math.max(1, list.length) }}
                onPrev={index > 0 ? move(index - 1) : null}
                onNext={index >= 0 && index < list.length - 1 ? move(index + 1) : null}
                onClose={() => setViewerId(null)}
              />
            </Suspense>
          );
        })()}

      {settingsOpen && <SettingsDialog onClose={closeSettings} />}

      {queuedFiles && (
        <UploadQueueDialog
          files={queuedFiles}
          defaults={createDefaults}
          folderIndex={folderIndex}
          onClose={closeQueue}
          onDone={(message) => {
            setNotice({ type: 'success', text: message });
            void reloadAll();
          }}
        />
      )}

      {draggingFiles && (
        <DropOverlay
          target={currentFolder ? `フォルダ「${currentFolder.name}」` : '未分類'}
        />
      )}
    </div>
  );
}
