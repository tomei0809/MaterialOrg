// 検索欄の履歴（直近に調べた語）を localStorage に保存する。新しい順・重複なし・最大 MAX_HISTORY 件

export const MAX_HISTORY = 8;
const STORAGE_KEY = 'mateorg:search-history';
const EMPTY: string[] = [];

// 大文字小文字・全角半角の違いは同じ語として扱う
const keyOf = (query: string) => query.normalize('NFKC').toLowerCase().trim();

// --- useSyncExternalStore 用の小さなストア ---

let current: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (current) return current;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    current = Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string').slice(0, MAX_HISTORY)
      : [];
  } catch {
    current = [];
  }
  return current;
}

function write(next: string[]) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // 保存できなくても、この画面の間は履歴を使える
  }
  listeners.forEach((listener) => listener());
}

export function getSearchHistory() {
  return read();
}

export function getServerSearchHistory() {
  return EMPTY;
}

export function subscribeSearchHistory(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// 先頭に追加する（同じ語がすでにあれば先頭へ繰り上げる）
export function addSearchHistory(query: string) {
  const text = query.trim();
  if (!text) return;
  // すでに先頭にあるなら何もしない（不要な再描画を避ける）
  if (read()[0] === text) return;
  const rest = read().filter((q) => keyOf(q) !== keyOf(text));
  write([text, ...rest].slice(0, MAX_HISTORY));
}

export function removeSearchHistory(query: string) {
  write(read().filter((q) => q !== query));
}

export function clearSearchHistory() {
  write([]);
}
