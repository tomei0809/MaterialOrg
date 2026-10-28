'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

export type ContextMenuItem = {
  label: string;
  onSelect?: () => void;
  // キーの案内（例：F2）
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  // 選択中の印（種類・フォルダ・タグなど）
  checked?: boolean;
  // この項目の上に区切り線を引く
  separator?: boolean;
  // 右側に開く子メニュー（onSelect の代わり）
  submenu?: ContextMenuItem[];
  // 子メニューで選んでもメニューを閉じない（タグの付け外しなど、続けて選ぶもの）
  keepOpen?: boolean;
};

type Props = {
  // 右クリックした位置（画面座標）
  x: number;
  y: number;
  // メニューの見出し（対象の名前）
  title?: string;
  items: ContextMenuItem[];
  onClose: () => void;
};

const itemClass =
  'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-muted focus:bg-surface-muted focus:outline-none disabled:opacity-40';

const focusables = (el: HTMLElement | null) => [
  ...(el?.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)') ?? []),
];

// 1段分のメニュー。子メニューは項目の右（はみ出すなら左）に開く
function MenuPanel({
  items,
  title,
  position,
  onClose,
  onBack,
  autoFocus,
}: {
  items: ContextMenuItem[];
  title?: string;
  position: { left: number; top: number };
  onClose: () => void;
  // 子メニューで ← を押したとき
  onBack?: () => void;
  autoFocus: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(position);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [childAt, setChildAt] = useState({ left: 0, top: 0 });
  // キーボードで子メニューを開いたときだけ、子メニューの先頭にフォーカスを移す
  const [childFocus, setChildFocus] = useState(false);

  // 画面の端からはみ出さないよう位置を調整し、最初の項目にフォーカスする
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPlaced({
      left: Math.max(4, Math.min(position.left, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(position.top, window.innerHeight - height - 4)),
    });
    if (autoFocus) focusables(el)[0]?.focus();
  }, [position.left, position.top, autoFocus]);

  function openChild(index: number, button: HTMLElement, byKeyboard: boolean) {
    const rect = button.getBoundingClientRect();
    // 子メニューの幅はおおよそ 220px。右に入らなければ左に開く
    const left = rect.right + 220 > window.innerWidth ? rect.left - 220 : rect.right - 2;
    setChildAt({ left, top: rect.top - 5 });
    setChildFocus(byKeyboard);
    setOpenIndex(index);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // 子メニューの中のキー操作は子メニューに任せる
    if (event.target instanceof Node && !ref.current?.contains(event.target)) return;
    const buttons = focusables(ref.current);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    } else if (event.key === 'ArrowRight') {
      const button = buttons[index];
      const itemIndex = Number(button?.dataset.index);
      if (button && items[itemIndex]?.submenu) {
        event.preventDefault();
        event.stopPropagation();
        openChild(itemIndex, button, true);
      }
    } else if (event.key === 'ArrowLeft' && onBack) {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }
  }

  const child = openIndex !== null ? items[openIndex] : null;

  return (
    <>
      <div
        ref={ref}
        role="menu"
        aria-label={title}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => event.preventDefault()}
        className="fixed z-[80] max-h-[70vh] min-w-52 overflow-y-auto rounded-md border border-border bg-surface py-1 text-sm shadow-xl"
        style={placed}
      >
        {title && (
          <p className="truncate border-b border-border px-3 pt-1 pb-1.5 text-xs font-bold text-muted">
            {title}
          </p>
        )}
        {items.map((item, index) => [
          item.separator && <hr key={`sep-${index}`} className="my-1 border-border" />,
          <button
            key={`${index}-${item.label}`}
            type="button"
            role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={item.checked}
            aria-haspopup={item.submenu ? 'menu' : undefined}
            aria-expanded={item.submenu ? openIndex === index : undefined}
            data-index={index}
            disabled={item.disabled}
            onMouseEnter={(event) =>
              item.submenu ? openChild(index, event.currentTarget, false) : setOpenIndex(null)
            }
            onClick={(event) => {
              if (item.submenu) {
                openChild(index, event.currentTarget, true);
                return;
              }
              if (!item.keepOpen) onClose();
              item.onSelect?.();
            }}
            className={`${itemClass} ${openIndex === index ? 'bg-surface-muted' : ''} ${
              item.danger ? 'text-danger' : ''
            }`}
          >
            {/* 選択の印の欄（どれか1つでも印がある段ではそろえる） */}
            {items.some((i) => i.checked !== undefined) && (
              <span aria-hidden="true" className="w-3 shrink-0 text-primary">
                {item.checked ? '✓' : ''}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate whitespace-pre">{item.label}</span>
            {item.hint && <kbd className="text-xs text-muted">{item.hint}</kbd>}
            {item.submenu && (
              <span aria-hidden="true" className="text-xs text-muted">
                ›
              </span>
            )}
          </button>,
        ])}
      </div>
      {child?.submenu && (
        <MenuPanel
          key={openIndex}
          items={child.submenu}
          title={undefined}
          position={childAt}
          onClose={onClose}
          autoFocus={childFocus}
          onBack={() => {
            const button = focusables(ref.current).find(
              (b) => Number(b.dataset.index) === openIndex,
            );
            setOpenIndex(null);
            button?.focus();
          }}
        />
      )}
    </>
  );
}

// 右クリックで出すメニュー。外側のクリック・Esc・スクロール・画面サイズの変更で閉じる。
// ↑↓ で項目を移動、→ で子メニューを開き ← で戻る、Enter で実行できる
export function ContextMenu({ x, y, title, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = () => onClose();
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    function onScroll(event: Event) {
      // メニュー自身のスクロール（長いフォルダ一覧など）では閉じない
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [onClose]);

  return (
    <div ref={ref}>
      <MenuPanel items={items} title={title} position={{ left: x, top: y }} onClose={onClose} autoFocus />
    </div>
  );
}
