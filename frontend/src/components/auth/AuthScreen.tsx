'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField, inputClass } from '@/components/ui/FormField';
import {
  fetchRegistration,
  login,
  MIN_PASSWORD_LENGTH,
  requestPasswordReset,
  signup,
  type CurrentUser,
} from '@/lib/authApi';
import { AuthMessage, AuthShell } from './AuthShell';

type Mode = 'login' | 'signup' | 'forgot';

const titles: Record<Mode, string> = {
  login: 'ログイン',
  signup: '新規登録',
  forgot: 'パスワードの再設定',
};

type Props = {
  onAuthenticated: (user: CurrentUser) => void;
  // ログインが切れて戻ってきたとき
  expired?: boolean;
};

// ログイン・新規登録・パスワードを忘れたときの画面
export function AuthScreen({ onAuthenticated, expired = false }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(expired ? 'ログインの有効期限が切れました。もう一度ログインしてください。' : '');
  // 新規登録を受け付けているか（閉じていれば「新規登録」のタブを出さない）
  const [registrationOpen, setRegistrationOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchRegistration()
      .then((open) => active && setRegistrationOpen(open))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setInfo('');
    setPassword('');
    setConfirmation('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (mode === 'signup' && password !== confirmation) {
      setError('確認用のパスワードが一致しません。');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') onAuthenticated(await login(email, password));
      else if (mode === 'signup') onAuthenticated(await signup(email, password, confirmation));
      else {
        const { message } = await requestPasswordReset(email);
        setInfo(`${message}。メールのリンクから15分以内に新しいパスワードを設定してください。`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '通信に失敗しました。');
    } finally {
      setBusy(false);
    }
  }

  const passwordType = showPassword ? 'text' : 'password';

  return (
    <AuthShell title={titles[mode]}>
      {mode !== 'forgot' && registrationOpen && (
        <div role="tablist" aria-label="ログインか新規登録か" className="mb-5 grid grid-cols-2 rounded-lg bg-surface-muted p-1 text-sm">
          {(['login', 'signup'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mode === tab}
              onClick={() => switchMode(tab)}
              className={`rounded-md py-1.5 font-bold ${
                mode === tab ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              {titles[tab]}
            </button>
          ))}
        </div>
      )}

      {error && <AuthMessage tone="error">{error}</AuthMessage>}
      {info && <AuthMessage tone="info">{info}</AuthMessage>}

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        {mode === 'forgot' && (
          <p className="text-sm text-muted">
            登録したメールアドレスを入力してください。パスワードを再設定するためのリンクを送ります。
          </p>
        )}

        <FormField id="auth-email" label="メールアドレス">
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </FormField>

        {mode !== 'forgot' && (
          <FormField id="auth-password" label="パスワード">
            <input
              id="auth-password"
              type={passwordType}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={mode === 'signup' ? 'auth-password-hint' : undefined}
              className={inputClass}
            />
            {mode === 'signup' && (
              <p id="auth-password-hint" className="text-xs text-muted">
                {MIN_PASSWORD_LENGTH}文字以上
              </p>
            )}
          </FormField>
        )}

        {mode === 'signup' && (
          <FormField id="auth-confirmation" label="パスワード（確認）">
            <input
              id="auth-confirmation"
              type={passwordType}
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className={inputClass}
            />
          </FormField>
        )}

        {mode !== 'forgot' && (
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
            パスワードを表示する
          </label>
        )}

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? '送信中…' : mode === 'login' ? 'ログイン' : mode === 'signup' ? '登録してはじめる' : '再設定のメールを送る'}
        </Button>
      </form>

      <div className="mt-4 text-center text-xs">
        {mode === 'login' && (
          <button type="button" onClick={() => switchMode('forgot')} className="text-primary hover:underline">
            パスワードを忘れた方
          </button>
        )}
        {mode === 'signup' && (
          <p className="text-muted">登録した教材は、あなただけが見られます。ほかの利用者とは共有されません。</p>
        )}
        {mode === 'forgot' && (
          <button type="button" onClick={() => switchMode('login')} className="text-primary hover:underline">
            ログインに戻る
          </button>
        )}
      </div>
    </AuthShell>
  );
}
