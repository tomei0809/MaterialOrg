'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { inputClass } from '@/components/ui/FormField';
import { useSearchHistory } from '@/hooks/useSearchHistory';
import {
  addSearchHistory,
  clearSearchHistory,
  removeSearchHistory,
} from '@/lib/searchHistory';

// 検索欄の id（「/」キーでここへ移動する）
export const SEARCH_INPUT_ID = 'material-search';

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
};

// 入力中の語に当たる部分を太字にする
function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-bold text-foreground">{text.slice(index, index + query.length)}</strong>
      {text.slice(index + query.length)}
    </>
  );
}

// 教材の検索欄。フォーカスすると直近に調べた語（最大8件）を出し、選ぶとその語で検索する
export function SearchBox({ query, onQueryChange }: Props) {
  const history = useSearchHistory();
  const [open, setOpen] = useState(false);
  // ↑↓ で選んでいる履歴（-1 は未選択）
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const typed = query.trim();
  const items = typed
    ? history.filter((q) => q.toLowerCase().includes(typed.toLowerCase()) && q !== typed)
    : history;
  const visible = open && items.length > 0;

  function choose(text: string) {
    onQueryChange(text);
    addSearchHistory(text);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!visible) {
        setOpen(true);
        return;
      }
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // -1（入力欄）→ 0 … 末尾 → -1 と一周する
      setActiveIndex((i) => {
        const next = i + step;
        if (next >= items.length) return -1;
        if (next < -1) return items.length - 1;
        return next;
      });
    } else if (event.key === 'Enter') {
      if (visible && activeIndex >= 0 && activeIndex < items.length) {
        event.preventDefault();
        choose(items[activeIndex]);
      } else {
        addSearchHistory(query);
        setOpen(false);
      }
    } else if (event.key === 'Escape' && visible) {
      // 一覧を開いているときは閉じるだけ（入力は消さない）
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        // 一覧の中（履歴の行・×）へのフォーカス移動では閉じない
        if (wrapperRef.current?.contains(event.relatedTarget as Node)) return;
        setOpen(false);
        setActiveIndex(-1);
        addSearchHistory(query);
      }}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      >
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="教材名・フォルダ名・タグ・説明で検索（スペース区切りで絞り込み）"
        aria-label="教材を検索"
        aria-keyshortcuts="/"
        className={`${inputClass} py-2.5 pr-9 pl-9`}
      />
      {!query && (
        <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-border px-1.5 text-xs text-muted">
          /
        </kbd>
      )}

      {visible && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-surface shadow-xl">
          <p className="px-3 pt-2 pb-1 text-xs text-muted">最近の検索</p>
          <ul id={listId} role="listbox" aria-label="最近の検索">
            {items.map((text, index) => (
              <li
                key={text}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // クリックで入力欄のフォーカスが外れて一覧が閉じる前に選ぶ
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(text)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`group flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm text-muted ${
                  index === activeIndex ? 'bg-surface-muted' : ''
                }`}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0">
                  <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  <Highlight text={text} query={typed} />
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSearchHistory(text);
                  }}
                  aria-label={`「${text}」を履歴から削除`}
                  title="履歴から削除"
                  className="rounded px-1 text-muted hover:bg-border hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-3 py-1.5 text-right">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                clearSearchHistory();
                setOpen(false);
              }}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              履歴をすべて消去
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
