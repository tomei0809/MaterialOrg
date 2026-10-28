# 本番環境への移行手順（Vercel ＋ Render ＋ Amazon S3）

この手順で、画面（Next.js）を Vercel、API（Rails）と PostgreSQL を Render、添付ファイルを Amazon S3 に置いて公開する。
候補の比較・費用の目安は [本番環境ガイド（PDF）](deployment-guide.pdf) を参照。

```
ブラウザ ──HTTPS──▶ Vercel（Next.js）──rewrites──▶ Render（Rails API・Docker）──▶ Render Postgres（DB 4つ）
                                                                     └──────────▶ Amazon S3（非公開バケット）
```

コード側の準備は済んでいる。

| ファイル | 内容 |
|---|---|
| `render.yaml` | Render の Blueprint（Rails の Web Service と PostgreSQL） |
| `backend/config/storage.yml` | `amazon`（S3）を環境変数から設定 |
| `backend/config/environments/production.rb` | 保存先 S3、HTTPS 扱い、`APP_HOST` によるホストの制限 |
| `backend/config/database.yml` | `DATABASE_URL` だけで cache・queue・cable の DB も決まる（DB 名に `_cache` などを付ける） |
| `backend/config/recurring.yml` | ゴミ箱の自動削除（毎日 4:00） |
| `backend/Gemfile` | `aws-sdk-s3` |

所要時間の目安：初回 1〜2 時間。費用の目安：月 約 $13（Render の Web Service $7 ＋ Postgres $6）＋ S3 の数十円。Vercel は Hobby（無料・個人の非商用）。

---

## 0. 事前に用意するもの

- [ ] GitHub にリポジトリを push しておく（Render と Vercel は GitHub から取り込む）
- [ ] AWS アカウント（ルートユーザーに MFA を設定しておく）
- [ ] Render アカウント（GitHub でサインイン）
- [ ] Vercel アカウント（GitHub でサインイン）
- [ ] `backend/config/master.key` の中身（Rails の秘密情報を開く鍵。リポジトリには入っていない）

> **注意**：`master.key` と AWS のアクセスキーは、チャット・メール・リポジトリに貼らない。各サービスの「環境変数（Secret）」の欄にだけ入れる。

## 1. Amazon S3（ファイルの保存先）

### 1.1 バケットを作る

1. AWS マネジメントコンソール → **S3** → 「バケットを作成」
2. 設定
   - バケット名：`materialorg-production-<任意の英数字>`（世界で一意。以下 `<BUCKET>`）
   - リージョン：**アジアパシフィック（東京）ap-northeast-1**
   - オブジェクト所有者：ACL 無効（推奨）
   - **パブリックアクセスをすべてブロック：オン**（そのまま）
   - バケットのバージョニング：有効（誤って消したときに戻せる）
   - デフォルトの暗号化：SSE-S3
3. 「バケットを作成」

### 1.2 Rails 用の IAM ユーザーを作る

1. **IAM** → ユーザー → 「ユーザーの作成」→ 名前 `materialorg-rails`（コンソールへのアクセスは不要）
2. 許可の設定 → 「ポリシーを直接アタッチ」→「ポリシーの作成」→ JSON に次を貼る（`<BUCKET>` を置き換える）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::<BUCKET>" },
    { "Effect": "Allow", "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::<BUCKET>/*" }
  ]
}
```

3. ポリシー名 `materialorg-s3-access` で作成し、ユーザーにアタッチする
4. 作ったユーザー → 「セキュリティ認証情報」→「アクセスキーを作成」→ 用途「AWS の外部で実行されるアプリケーション」
5. **アクセスキー ID** と **シークレットアクセスキー** を控える（シークレットはこの画面でしか見られない）

### 1.3 費用の見張り（推奨）

**Billing → Budgets** で月 $5 などの予算を作り、超えそうなときにメールが届くようにする。

## 2. Render（Rails API と PostgreSQL）

1. Render のダッシュボード → **New → Blueprint**
2. GitHub のリポジトリ `MaterialOrganization` を選ぶ（ブランチは公開に使うもの。通常は `main`）
3. Render がルートの `render.yaml` を読み、次の2つを作る案を出す
   - `materialorg-db`（PostgreSQL、Singapore、0.1c-256mb）
   - `materialorg-api`（Docker の Web Service、Singapore、0.5c-512mb）
4. `sync: false` の値の入力を求められるので入れる

| キー | 入れる値 |
|---|---|
| `RAILS_MASTER_KEY` | `backend/config/master.key` の中身（32文字） |
| `AWS_ACCESS_KEY_ID` | 1.2 で控えたアクセスキー ID |
| `AWS_SECRET_ACCESS_KEY` | 1.2 で控えたシークレットアクセスキー |
| `S3_BUCKET` | 1.1 のバケット名 |
| `APP_HOST` | いったん空でよい（3. の後で入れる） |

5. 「Apply」。初回はイメージのビルドに 5〜10 分かかる
6. 起動時に `bin/docker-entrypoint` が `db:prepare` を実行し、次の4つの DB とテーブルを作る
   - `materialorg_production`（教材など）
   - `materialorg_production_cache` / `_queue` / `_cable`（Solid Cache・Queue・Cable）
7. Web Service の URL（例 `https://materialorg-api.onrender.com`）を控える。以下 `<API_URL>`
8. 確認：ブラウザで `<API_URL>/up` が緑の画面（200）、`<API_URL>/api/v1/folders` が `[]`

> **DB を作れずに起動が失敗したとき**（ログに `permission denied to create database`）：
> Render の DB の「Connect → External Connection」の `psql` コマンドで接続し、次を実行してから「Manual Deploy → Deploy latest commit」。
> ```sql
> CREATE DATABASE materialorg_production_cache;
> CREATE DATABASE materialorg_production_queue;
> CREATE DATABASE materialorg_production_cable;
> ```

## 3. Vercel（Next.js）

1. Vercel のダッシュボード → **Add New → Project** → 同じリポジトリを Import
2. 設定
   - **Root Directory：`frontend`**（Framework Preset は Next.js が自動で選ばれる）
   - **Environment Variables**：`RAILS_API_URL` ＝ `<API_URL>`（末尾に `/` を付けない）。Production と Preview の両方
3. 「Deploy」。完了すると `https://<project>.vercel.app` が発行される（以下 `<WEB_URL>`）

> `RAILS_API_URL` は**ビルド時**に rewrites へ埋め込まれる。値を変えたら「Redeploy」が必要。

## 4. ホスト名の制限を有効にする

Render の `materialorg-api` → Environment → `APP_HOST` に `<API_URL>` のホスト名（例 `materialorg-api.onrender.com`）を入れて保存する（自動で再デプロイされる）。
独自ドメインを付けたら、カンマ区切りで足す（例 `materialorg-api.onrender.com,api.example.com`）。

## 5. 公開後の確認

`<WEB_URL>` を開いて、上から順に確認する。

| # | 確認すること | 期待する結果 |
|---|---|---|
| 1 | 画面が開く | 「すべての教材 0件」と空の一覧。開発者ツールの Network で `/api/v1/materials` が 200 |
| 2 | フォルダを作る | サイドバーとマップに出る。再読み込みしても残る |
| 3 | 小さな PDF（1MB 程度）を登録 | 一覧に出る。S3 のバケットに `<ランダムなキー>` のオブジェクトが増える |
| 4 | ビューアで開く | PDF が表示される。S3 のオブジェクトの URL を直接開くと AccessDenied（非公開） |
| 5 | 動画・音声を登録して位置を移す | その位置から再生される（Network で 206） |
| 6 | 大きなファイル（10MB・100MB） | 登録できる。**413 などで失敗したら 6. を参照** |
| 7 | 教材をゴミ箱へ → 元に戻す | 一覧から消えて戻る。ゴミ箱で「完全に削除」すると、少し後に S3 のオブジェクトも消える |
| 8 | Render のログ | `Completed 200` が並び、エラーがない |

## 6. うまくいかないとき

| 症状 | 見る場所・対処 |
|---|---|
| 画面は開くが一覧が「読み込めません」 | Vercel の `RAILS_API_URL` が `<API_URL>` と一致しているか（`https://`・末尾の `/`）。変えたら Redeploy |
| API が 403（Blocked hosts） | Render の `APP_HOST` に、そのホスト名が入っているか |
| Render のデプロイが失敗 | Render → Logs。`RAILS_MASTER_KEY` の誤り（`ActiveSupport::MessageEncryptor::InvalidMessage`）、DB の作成権限（2. の注意） |
| 登録で 500・`Aws::S3::Errors::AccessDenied` | IAM ポリシーのバケット名、`S3_BUCKET`、リージョン |
| 大きなファイルだけ失敗（413 など） | Vercel の転送経路の上限。小さなファイルで運用するか、[本番環境ガイド](deployment-guide.pdf) 7.3 の「S3 への直接アップロード」を実装する |
| しばらく使わないと最初の表示が遅い | Render の無料プランは休止する。`render.yaml` の plan（0.5c-512mb）なら休止しない |

## 7. その後の運用

- `main` に push すると、Render と Vercel が自動で再デプロイする（マイグレーションは起動時の `db:prepare` で実行）。
- GitHub Actions の CI が通ったものだけをマージする。
- ゴミ箱は30日を過ぎたものが毎日 4:00 に自動で完全に削除される（Solid Queue。`SOLID_QUEUE_IN_PUMA=true`）。
- 公開範囲：今はログイン機能がない。URL を知っている人は誰でも操作できるので、URL を広く共有しない。広く公開する前に認証を追加する。
- バックアップ：Render の有料 DB は毎日自動でバックアップされる。S3 はバージョニングで誤削除に備える。
