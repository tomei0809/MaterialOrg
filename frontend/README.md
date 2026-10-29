# frontend（Next.js）

MaterialOrg の画面です。Next.js 16（App Router）・React 19・TypeScript・Tailwind CSS v4 で作っています。
`/api/*` と `/rails/active_storage/*` は `RAILS_API_URL`（既定 `http://localhost:3000`）の Rails へ転送します（`next.config.ts`）。
アプリ全体の説明・起動方法はリポジトリ直下の [README](../README.md) を見てください。

```bash
npm install
npm run dev -- -p 3001      # http://localhost:3001
npm run lint
npm run typecheck           # next typegen && tsc --noEmit
npm run build
```

| ディレクトリ | 内容 |
|---|---|
| `src/app` | ページとレイアウト |
| `src/components` | layout（サイドバー・設定）・materials（一覧・マップ・詳細・ゴミ箱）・preview・viewer・ui |
| `src/hooks` | データの取得と表示設定の保存 |
| `src/lib` | API の呼び出し、並び替え・絞り込み、PDF・Office・ZIP の読み取り |
| `src/types` | 型定義 |
