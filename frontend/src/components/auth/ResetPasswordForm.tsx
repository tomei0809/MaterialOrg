'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField, inputClass } from '@/components/ui/FormField';
import { MIN_PASSWORD_LENGTH, resetPassword } from '@/lib/authApi';
import { AuthMessage, AuthShell } from './AuthShell';

// メールのリンクから開く、新しいパスワードの設定
export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('確認用のパスワードが一致しません。');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password, confirmation);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="パスワードの再設定">
        <AuthMessage tone="error">リンクが正しくありません。メールのリンクをもう一度開いてください。</AuthMessage>
        <Link href="/" className="text-sm text-primary hover:underline">
          ログイン画面へ
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="パスワードを変更しました">
        <AuthMessage tone="info">新しいパスワードでログインしてください。ほかの端末のログインは終了しました。</AuthMessage>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover"
        >
          ログイン画面へ
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="新しいパスワードの設定">
      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <FormField id="reset-password" label="新しいパスワード">
          <input
            id="reset-password"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-muted">{MIN_PASSWORD_LENGTH}文字以上</p>
        </FormField>
        <FormField id="reset-confirmation" label="新しいパスワード（確認）">
          <input
            id="reset-confirmation"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className={inputClass}
          />
        </FormField>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? '変更しています…' : 'パスワードを変更する'}
        </Button>
      </form>
    </AuthShell>
  );
}
