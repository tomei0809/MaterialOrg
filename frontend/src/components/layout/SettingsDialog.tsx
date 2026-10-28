'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { usePreferences } from '@/hooks/usePreferences';
import {
  ACCENTS,
  SIDEBAR_STYLES,
  THEMES,
  type Accent,
  type SidebarStyle,
  type Theme,
} from '@/lib/preferences';

const themeLabels: Record<Theme, string> = {
  system: 'OSに合わせる',
  light: 'ライト',
  dark: 'ダーク',
};

const accentLabels: Record<Accent, string> = {
  blue: '青',
  green: '緑',
  purple: '紫',
  orange: 'オレンジ',
  pink: 'ピンク',
};

// 見本の色（実際の色は globals.css のアクセント定義）
const accentSwatches: Record<Accent, string> = {
  blue: 'bg-[#2f5da8]',
  green: 'bg-[#15803d]',
  purple: 'bg-[#6d3fd1]',
  orange: 'bg-[#c2410c]',
  pink: 'bg-[#be185d]',
};

const sidebarLabels: Record<SidebarStyle, string> = {
  dark: '濃い色',
  light: '背景になじむ色',
};

function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
        checked ? 'border-primary bg-primary-soft font-bold' : 'border-border hover:bg-surface-muted'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {children}
    </label>
  );
}

// アプリ独自の表示設定（ブラウザ・OS の設定とは別に保存される）
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [preferences, setPreferences] = usePreferences();

  return (
    <Dialog title="表示設定" onClose={onClose}>
      <div className="space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">テーマ</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((theme) => (
              <Choice
                key={theme}
                name="theme"
                checked={preferences.theme === theme}
                onChange={() => setPreferences({ theme })}
              >
                <span className="w-full text-center text-xs">{themeLabels[theme]}</span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-bold">アクセントカラー</legend>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((accent) => (
              <Choice
                key={accent}
                name="accent"
                checked={preferences.accent === accent}
                onChange={() => setPreferences({ accent })}
              >
                <span className={`size-4 rounded-full ${accentSwatches[accent]}`} />
                {accentLabels[accent]}
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-bold">サイドバーの色</legend>
          <div className="grid grid-cols-2 gap-2">
            {SIDEBAR_STYLES.map((style) => (
              <Choice
                key={style}
                name="sidebar-style"
                checked={preferences.sidebarStyle === style}
                onChange={() => setPreferences({ sidebarStyle: style })}
              >
                <span
                  className={`h-4 w-3 rounded-sm border border-border ${
                    style === 'dark' ? 'bg-[#14213d]' : 'bg-[#eef1f6]'
                  }`}
                />
                {sidebarLabels[style]}
              </Choice>
            ))}
          </div>
        </fieldset>

        <p className="text-xs text-muted">設定はこのブラウザに保存されます。</p>

        <div className="flex justify-end">
          <Button onClick={onClose}>閉じる</Button>
        </div>
      </div>
    </Dialog>
  );
}
