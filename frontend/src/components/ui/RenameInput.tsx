'use client';

import { useRef, useState } from 'react';

type Props = {
  value: string;
  maxLength: number;
  label: string;
  // 名前が変わったときだけ呼ぶ（空・同じ名前なら onCancel）
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
};

// その場で名前を書き換える入力欄。Enter・フォーカスが外れたら確定、Esc で取り消し
export function RenameInput({ value, maxLength, label, onCommit, onCancel, className = '' }: Props) {
  const [draft, setDraft] = useState(value);
  // Enter と blur の両方で確定が走らないようにする
  const done = useRef(false);

  function finish(commit: boolean) {
    if (done.current) return;
    done.current = true;
    const name = draft.trim();
    if (commit && name && name !== value) onCommit(name);
    else onCancel();
  }

  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(true);
        if (event.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
      onClick={(event) => event.stopPropagation()}
      className={`min-w-0 flex-1 rounded border border-primary bg-surface px-1.5 py-0.5 text-[13px] text-foreground outline-none ring-2 ring-primary/25 ${className}`}
    />
  );
}
