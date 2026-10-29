'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { FormField, inputClass } from '@/components/ui/FormField';
import { usePreferences } from '@/hooks/usePreferences';
import { changePassword, MIN_PASSWORD_LENGTH, type CurrentUser } from '@/lib/authApi';
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

// パスワードの変更（今のパスワードが必要。変更するとほかの端末のログインは終わる）
function PasswordChange() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage({ tone: 'error', text: '確認用のパスワードが一致しません。' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, password, confirmation);
      setMessage({ tone: 'info', text: 'パスワードを変更しました。ほかの端末のログインは終了しました。' });
      setCurrent('');
      setPassword('');
      setConfirmation('');
      setOpen(false);
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof Error ? err.message : '変更できませんでした。' });
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setOpen(true);
    setMessage(null);
  }

  return (
    <div className="w-full">
      {message && (
        <p
          role={message.tone === 'error' ? 'alert' : 'status'}
          className={`mb-2 rounded-lg px-3 py-2 text-xs whitespace-pre-line ${
            message.tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
          }`}
        >
          {message.text}
        </p>
      )}
      {open ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 rounded-lg border border-border p-3">
          <FormField id="current-password" label="今のパスワード">
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField id="new-password" label={`新しいパスワード（${MIN_PASSWORD_LENGTH}文字以上）`}>
            <input
              id="new-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField id="new-password-confirmation" label="新しいパスワード（確認）">
            <input
              id="new-password-confirmation"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              やめる
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? '変更しています…' : '変更する'}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" onClick={start}>
          パスワードを変更
        </Button>
      )}
    </div>
  );
}

type Props = {
  user: CurrentUser;
  onLogout: () => void;
  onClose: () => void;
};

// アカウントと、アプリ独自の表示設定（表示設定はブラウザ・OS の設定とは別に保存される）
export function SettingsDialog({ user, onLogout, onClose }: Props) {
  const [preferences, setPreferences] = usePreferences();

  return (
    <Dialog title="設定" onClose={onClose}>
      <div className="max-h-[75vh] space-y-5 overflow-y-auto">
        <fieldset>
          <legend className="mb-2 text-sm font-bold">アカウント</legend>
          <div className="mb-3 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm" title={user.email_address}>
              {user.email_address}
            </span>
            <Button variant="danger" onClick={onLogout} className="shrink-0 py-1.5">
              ログアウト
            </Button>
          </div>
          <PasswordChange />
        </fieldset>

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

        <p className="text-xs text-muted">テーマ・色・サイドバーの設定はこのブラウザに保存されます。</p>

        <div className="flex justify-end">
          <Button onClick={onClose}>閉じる</Button>
        </div>
      </div>
    </Dialog>
  );
}
