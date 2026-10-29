'use client';

import { useEffect, useState } from 'react';
import { MaterialsApp } from '@/components/materials/MaterialsApp';
import { UNAUTHORIZED_EVENT } from '@/lib/apiFetch';
import { fetchSession, logout, type CurrentUser } from '@/lib/authApi';
import { clearSearchHistory } from '@/lib/searchHistory';
import { AuthScreen } from './AuthScreen';

type State =
  | { status: 'loading' }
  | { status: 'signed-out'; expired: boolean }
  | { status: 'signed-in'; user: CurrentUser };

// ログインしていればアプリを、していなければログイン画面を出す
export function AuthGate() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    fetchSession()
      .then((user) => {
        if (active) setState(user ? { status: 'signed-in', user } : { status: 'signed-out', expired: false });
      })
      .catch(() => {
        if (active) setState({ status: 'signed-out', expired: false });
      });

    // 使っている途中でログインが切れたら（API が 401）、ログイン画面へ戻す
    const onUnauthorized = () =>
      setState((current) => (current.status === 'signed-in' ? { status: 'signed-out', expired: true } : current));
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      active = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  async function handleLogout() {
    await logout().catch(() => {});
    // 同じ端末をほかの人が使っても、検索した語が見えないようにする
    clearSearchHistory();
    setState({ status: 'signed-out', expired: false });
  }

  if (state.status === 'loading') {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center text-sm text-muted">
        読み込んでいます…
      </div>
    );
  }

  if (state.status === 'signed-out') {
    return (
      <AuthScreen
        expired={state.expired}
        onAuthenticated={(user) => setState({ status: 'signed-in', user })}
      />
    );
  }

  // 利用者が変わったら画面の状態を作り直す
  return <MaterialsApp key={state.user.id} user={state.user} onLogout={() => void handleLogout()} />;
}
