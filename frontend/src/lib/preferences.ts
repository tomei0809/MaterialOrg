// 表示設定（テーマ・アクセントカラー・サイドバー）を localStorage に保存し、
// <html> の data-* 属性に反映する。色の定義は app/globals.css にある。

import { GROUP_BY_OPTIONS, type GroupBy } from '@/types/material';
import { LIST_COLUMN_OPTIONS, type ListColumns } from './listColumns';

export const THEMES = ['system', 'light', 'dark'] as const;
export const ACCENTS = ['blue', 'green', 'purple', 'orange', 'pink'] as const;
export const SIDEBAR_STYLES = ['dark', 'light'] as const;

export type Theme = (typeof THEMES)[number];
export type Accent = (typeof ACCENTS)[number];
export type SidebarStyle = (typeof SIDEBAR_STYLES)[number];

export type Preferences = {
  theme: Theme;
  accent: Accent;
  sidebarStyle: SidebarStyle;
  sidebarCollapsed: boolean;
  // 一覧の上の資料マップを閉じているか
  mapCollapsed: boolean;
  // 一覧の区切り方
  groupBy: GroupBy;
  // 一覧を何列に分けて並べるか（1・2・3列）
  listColumns: ListColumns;
};

export const defaultPreferences: Preferences = {
  theme: 'system',
  accent: 'blue',
  sidebarStyle: 'dark',
  sidebarCollapsed: false,
  mapCollapsed: false,
  groupBy: 'folder',
  listColumns: 1,
};

export const STORAGE_KEY = 'mateorg:preferences';

function parse(raw: string | null): Preferences {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<Preferences>) : {};
    return {
      theme: THEMES.includes(value.theme as Theme) ? (value.theme as Theme) : 'system',
      accent: ACCENTS.includes(value.accent as Accent) ? (value.accent as Accent) : 'blue',
      sidebarStyle: SIDEBAR_STYLES.includes(value.sidebarStyle as SidebarStyle)
        ? (value.sidebarStyle as SidebarStyle)
        : 'dark',
      sidebarCollapsed: value.sidebarCollapsed === true,
      mapCollapsed: value.mapCollapsed === true,
      groupBy: GROUP_BY_OPTIONS.includes(value.groupBy as GroupBy)
        ? (value.groupBy as GroupBy)
        : 'folder',
      listColumns: LIST_COLUMN_OPTIONS.includes(value.listColumns as ListColumns)
        ? (value.listColumns as ListColumns)
        : 1,
    };
  } catch {
    return defaultPreferences;
  }
}

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply(prefs: Preferences) {
  const root = document.documentElement;
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && prefersDark());
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = prefs.accent;
  root.dataset.sidebar = prefs.sidebarStyle;
  root.style.colorScheme = dark ? 'dark' : 'light';
}

// --- useSyncExternalStore 用の小さなストア ---

let current: Preferences | null = null;
const listeners = new Set<() => void>();

function read(): Preferences {
  if (current) return current;
  try {
    current = parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    current = defaultPreferences;
  }
  return current;
}

export function getPreferences() {
  return read();
}

export function getServerPreferences() {
  return defaultPreferences;
}

export function setPreferences(patch: Partial<Preferences>) {
  current = { ...read(), ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // 保存できなくても、この画面の間は設定を反映する
  }
  apply(current);
  listeners.forEach((listener) => listener());
}

export function subscribePreferences(listener: () => void) {
  listeners.add(listener);

  // 「システムに合わせる」ときは OS の切り替えにも追従する
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => apply(read());
  media.addEventListener('change', onChange);

  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onChange);
  };
}

// 描画前に <head> で実行し、保存済みの設定を反映して色のちらつきを防ぐ
export const preferencesInitScript = `(() => {
  try {
    const p = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '{}');
    const theme = p.theme || 'system';
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.accent = p.accent || 'blue';
    root.dataset.sidebar = p.sidebarStyle || 'dark';
    root.style.colorScheme = dark ? 'dark' : 'light';
  } catch {}
})();`;
