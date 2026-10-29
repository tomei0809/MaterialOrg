# 環境構築手順書：Material Organization

## 1. 目的

手元の PC に開発環境を作り、Rails API（backend）と Next.js（frontend）をつないで動かせる状態にする。
本番環境の作り方は [本番環境への移行手順](deployment.md) を参照。

## 2. 必要なもの

| もの | 版 | 確かめ方 |
|---|---|---|
| Git | 最新 | `git --version` |
| Ruby | 4.0.7（`backend/.ruby-version`） | `ruby -v` |
| Bundler | Ruby に付属 | `bundle -v` |
| Node.js・npm | 24 以上 | `node -v`・`npm -v` |
| PostgreSQL | 16 以上（起動しておく） | `psql --version` |
| エディタ | VS Code など | |

- Windows では RubyInstaller（Devkit 付き）で Ruby を入れる。画像処理の libvips の警告（`VIPS-WARNING`）が出ても動作には影響しない。
- PostgreSQL の `postgres` ユーザーのパスワードを控えておく。

## 3. リポジトリを取得する

```bash
git clone https://github.com/tomei0809/MaterialOrganization.git
cd MaterialOrganization
```

## 4. バックエンド（Rails API）

```bash
cd backend
bundle install

# PostgreSQL の postgres ユーザーのパスワード（開発・テストの DB への接続に使う）
export POSTGRES_PASSWORD=（ローカルの postgres のパスワード）
# PowerShell では $env:POSTGRES_PASSWORD="…"

bin/rails db:prepare     # DB の作成とマイグレーション（backend_development）
bin/rails server         # http://localhost:3000
```

- `config/master.key` はリポジトリに入っていない。開発では無くても動くが、本番の秘密情報（`credentials.yml.enc`）を扱うときは、持っている人から受け取る。
- ブラウザで http://localhost:3000/up が緑の画面になれば起動している。
- API はログインが必要なので、`/api/v1/materials` を直接開くと 401（`ログインしてください`）になる。これは正常。

## 5. フロントエンド（Next.js）

別のターミナルで実行する。

```bash
cd frontend
npm install
npm run dev -- -p 3001   # http://localhost:3001
```

- `/api/*` と `/rails/active_storage/*` は、`next.config.ts` の rewrites で Rails（既定 `http://localhost:3000`）へ転送される。Rails を別のポートで動かすときは `RAILS_API_URL=http://localhost:4000` のように指定する。
- 画面と API がブラウザから見て同じオリジンになるため、CORS の設定は要らない。

## 6. 初めて使う

1. http://localhost:3001 を開くとログイン画面が出る。「新規登録」で自分のアカウントを作る（メールアドレスとパスワード8文字以上）。
2. ログイン機能より前に登録していた教材がある場合は、持ち主がいないため表示されない。次のコマンドで自分のアカウントに割り当てる。
   ```bash
   cd backend
   bin/rails users:claim_orphans EMAIL=登録したアドレス
   ```
3. パスワード再設定を試すとき：開発ではメールは送られない。Rails のログ（ターミナル）に `[PasswordsMailer] 再設定のリンク: http://localhost:3001/reset-password?token=…` が出るので、それを開く。
4. 登録できる人数は `MAX_USERS`（既定 10）まで。手元で増やすときは `MAX_USERS=20 bin/rails server` のように起動する。

## 7. テスト・静的解析

```bash
# バックエンド
cd backend
bin/rails db:test:prepare test
bin/rubocop
bin/brakeman --no-pager
bin/bundler-audit

# フロントエンド
cd frontend
npm run lint
npm run typecheck   # next typegen && tsc --noEmit
npm run build
```

内容と画面での確認項目は [テスト手順](testing.md) を参照。GitHub Actions も同じ内容をプッシュのたびに実行する。

## 8. 環境構築の完了条件

- [ ] http://localhost:3000/up が 200
- [ ] http://localhost:3001 でログイン画面が出て、新規登録・ログインができる
- [ ] 教材を登録でき、ビューアで添付ファイルを開ける
- [ ] `bin/rails db:test:prepare test` と `npm run lint`・`npm run typecheck` が通る

## 9. うまくいかないとき

| 症状 | 対処 |
|---|---|
| `db:prepare` で接続できない | PostgreSQL が起動しているか、`POSTGRES_PASSWORD` が正しいか |
| ログインや新規登録でエラーになる・一覧が読み込めない | Rails（3000番）が起動しているか、`RAILS_API_URL` が正しいか |
| ログインしてもすぐログイン画面に戻る | Rails を再起動する（Cookie の設定を変えた後は再起動が必要） |
| 既存の教材が見えない | 6. の `users:claim_orphans` を実行する |
| `Database not found` などマイグレーションの不足 | `bin/rails db:migrate` |

## 10. 注意事項

- 秘密情報（`master.key`、`.env`、AWS・Brevo の鍵、DB のパスワード）はコミットしない（`.gitignore` で除外済み）。
- 開発用のポートは Rails が 3000、Next.js が 3001。ほかの用途で使うときは重ならないようにする。
