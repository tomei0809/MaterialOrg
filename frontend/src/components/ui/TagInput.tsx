'use client';

import { useState, type KeyboardEvent } from 'react';
import { MAX_TAG_LENGTH, MAX_TAGS } from '@/types/material';
import { TagChip } from './TagChip';

type Props = {
  id: string;
  value: string[];
  onChange: (tags: string[]) => void;
  // 候補として表示するタグ（選択済みのものは自動で除く）
  suggestions: string[];
};

// 「、」「,」区切りでまとめて入力された場合も分割する
function splitTags(text: string) {
  return text
    .split(/[,、，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function TagInput({ id, value, onChange, suggestions }: Props) {
  const [draft, setDraft] = useState('');
  const isFull = value.length >= MAX_TAGS;

  function addTags(names: string[]) {
    const next = [...value];
    for (const name of names) {
      if (next.length >= MAX_TAGS) break;
      if (name.length <= MAX_TAG_LENGTH && !next.includes(name)) next.push(name);
    }
    onChange(next);
  }

  function commitDraft() {
    if (draft.trim()) addTags(splitTags(draft));
    setDraft('');
  }

  function removeTag(name: string) {
    onChange(value.filter((tag) => tag !== name));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // 日本語入力の変換確定の Enter ではタグを追加しない
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter' || event.key === ',') {
      // Enter でフォームが送信されないようにする
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  const remainingSuggestions = suggestions
    .filter((name) => !value.includes(name))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
        {value.map((tag) => (
          <TagChip key={tag} name={tag} onRemove={() => removeTag(tag)} />
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          disabled={isFull}
          maxLength={MAX_TAG_LENGTH}
          placeholder={
            isFull
              ? `タグは${MAX_TAGS}個までです`
              : value.length === 0
                ? '例：試験対策（Enterで追加）'
                : ''
          }
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-muted/70 focus:outline-none disabled:cursor-not-allowed"
        />
      </div>

      {remainingSuggestions.length > 0 && !isFull && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">候補：</span>
          {remainingSuggestions.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => addTags([name])}
              className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary"
            >
              ＋ {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
