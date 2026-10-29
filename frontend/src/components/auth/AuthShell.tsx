import type { ReactNode } from 'react';

// ログイン・新規登録・再設定の画面に共通の枠（アプリの目印と、中央のカード）
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          {/* サイドバーと同じ、バインダーのインデックスタブを模した目印 */}
          <span aria-hidden="true" className="flex h-7 items-end gap-0.5">
            {['blue', 'green', 'yellow'].map((color, i) => (
              <span
                key={color}
                className="w-2 rounded-t-sm"
                style={{ height: `${100 - i * 22}%`, background: `var(--fc-${color})` }}
              />
            ))}
          </span>
          <span className="text-xl font-bold">MaterialOrg</span>
        </div>

        <section
          aria-labelledby="auth-title"
          className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          {/* フォルダの色のタブを並べた細い帯 */}
          <div aria-hidden="true" className="flex h-1">
            {['blue', 'green', 'yellow', 'red', 'purple', 'teal'].map((color) => (
              <span key={color} className="flex-1" style={{ background: `var(--fc-${color})` }} />
            ))}
          </div>
          <div className="px-6 pt-5 pb-6">
            <h1 id="auth-title" className="mb-4 text-lg font-bold">
              {title}
            </h1>
            {children}
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-muted">
          講義資料をフォルダとタグで整理して、すぐに開けるようにするアプリです
        </p>
      </div>
    </main>
  );
}

// フォームの上に出すエラー・お知らせ
export function AuthMessage({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`mb-4 rounded-lg px-3 py-2 text-sm whitespace-pre-line ${
        tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
      }`}
    >
      {children}
    </p>
  );
}
