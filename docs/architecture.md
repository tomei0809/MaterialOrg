# システム構成設計：Material Organization

## 1. 目的

Material Organization の構成要素、各技術の役割、データの流れを定義する。
本番環境の作り方は [本番環境への移行手順](deployment.md)、デプロイ先の候補の比較は [本番環境ガイド（PDF）](deployment-guide.pdf) にまとめている。

## 2. システム構成

ブラウザが直接話す相手は Next.js だけにする。Next.js は画面を返すとともに、`/api/*` と `/rails/active_storage/*` を Rails API へ転送する（`frontend/next.config.ts` の rewrites）。
ブラウザから見ると画面と API が同じオリジンになるため、CORS・Cookie の設定が要らない。

### 2.1 開発環境

```mermaid
flowchart LR
    B["ブラウザ"] -->|"画面・/api・/rails/active_storage"| N["Next.js<br/>npm run dev（:3001）"]
    N -->|"rewrites で転送<br/>RAILS_API_URL"| R["Rails API<br/>bin/rails server（:3000）"]
    R -->|"Active Record"| P[("PostgreSQL<br/>backend_development")]
    R -->|"Active Storage（local）"| D[("ローカルディスク<br/>backend/storage")]
```

### 2.2 本番環境

```mermaid
flowchart LR
    B["ブラウザ"] -->|"HTTPS"| N["Vercel<br/>Next.js"]
    N -->|"rewrites で転送（HTTPS）<br/>RAILS_API_URL"| R["Render（render.yaml）<br/>Rails API・Docker・Puma<br/>Solid Queue のジョブも同居"]
    R -->|"DATABASE_URL"| P[("Render Postgres<br/>primary・cache・queue・cable")]
    R -->|"Active Storage（amazon）<br/>IAM の最小権限"| S[("Amazon S3<br/>非公開バケット")]
    G["GitHub"] -->|"push で CI（GitHub Actions）"| G
    G -.->|"自動デプロイ"| N
    G -.->|"自動デプロイ"| R
```

## 3. 各技術の役割

| 要素 | 役割 |
|---|---|
| Next.js 16（App Router）・React 19・TypeScript | 画面の表示と操作。教材一覧・資料マップ・ビューアなどはクライアント側で描画する。rewrites で Rails への入口を1つにまとめる |
| Tailwind CSS v4 | 見た目。ライト／ダーク、フォルダの色はデザイントークン（CSS 変数）で管理する |
| pdf.js・独自の ZIP 読み取り | PDF のプレビューとビューア、Office（docx/pptx/xlsx）・ZIP の中身表示をブラウザ内で行う |
| Ruby on Rails 8.1（API モード） | 入力の検証、教材・フォルダ・まとめ・タグの登録・取得・更新・削除、ファイルの受け取りと配信 |
| PostgreSQL | 教材・フォルダ・まとめ・タグと、その関連を保存する。本番では Rails 8 の Solid Cache・Solid Queue・Solid Cable 用の DB も使う |
| Active Storage | 教材とファイルを関連付ける。保存先を環境で切り替える（開発：ディスク、本番：S3） |
| Amazon S3 | 本番のファイル保存先。バケットは公開せず、Rails からだけ読み書きする |
| GitHub・GitHub Actions | ソースと変更履歴の管理。push・プルリクエストごとに静的解析・テスト・ビルドを実行する |

## 4. 通信方式

- ブラウザ ⇄ Next.js ⇄ Rails はすべて HTTP（本番は HTTPS）。
- データの受け渡しは JSON。ファイルのアップロードは `multipart/form-data`。
- API のパスは `/api/v1/...`。仕様は [API仕様書](api-spec.md) を参照。
- 成功・失敗は HTTP ステータスで表し、失敗時は `{ "errors": ["..."] }` を返す。

## 5. データ処理の流れ

### 5.1 一覧の取得

```mermaid
sequenceDiagram
    participant B as ブラウザ
    participant N as Next.js
    participant R as Rails API
    participant P as PostgreSQL
    B->>N: GET /api/v1/materials, /folders, /bundles, /tags
    N->>R: そのまま転送
    R->>P: SELECT（タグ・添付を includes）
    P-->>R: 行
    R-->>N: JSON（file_url は /rails/active_storage/... の相対パス）
    N-->>B: JSON
    Note over B: 並び替え・絞り込み・資料マップの集計はブラウザで行う
```

### 5.2 教材の登録

1. 利用者がファイルをドロップし、タイトル・種類・タグを入力する。
2. ブラウザが `POST /api/v1/materials` に `multipart/form-data` で送る（Next.js が Rails へ転送）。
3. Rails がタイトル・種類・タグ・拡張子・サイズ（500MB まで）を検証する。
4. Active Storage がファイルを保存先（開発はディスク、本番は S3）へ書き込み、教材とタグを1つのトランザクションで保存する。
5. 登録した教材の JSON を返し、画面の一覧を更新する。

### 5.3 削除とゴミ箱

1. 削除するとゴミ箱へ移る（`materials.deleted_at` に日時を入れる）。一覧・件数・一括操作の対象から外れ、まとめからは外れる。
2. 画面の通知の「元に戻す」か、サイドバーの「ゴミ箱」から元に戻せる。
3. ゴミ箱で「完全に削除」したもの、または30日を過ぎたもの（`PurgeTrashJob` が毎日 4:00 に実行）は、教材と添付ファイル（S3 の実体）を削除する。添付の削除は Active Storage がジョブで行う。

### 5.4 ファイルの表示

1. プレビュー・ビューアは `file_url`（`/rails/active_storage/blobs/proxy/...`）を読み込む。
2. Next.js が Rails へ転送し、Rails が保存先からファイルを読み出して返す（proxy 方式）。
3. 動画・音声の位置合わせでは Range リクエストを使い、必要な部分だけを受け取る。

## 6. セキュリティ方針

- 秘密情報（`RAILS_MASTER_KEY`、DB の接続情報、AWS の鍵）はリポジトリに入れず、環境変数かホスティング先のシークレット管理で渡す。
- 入力の検証はすべて Rails 側で行う（フロントエンドの検証は使いやすさのため）。
- 添付ファイルは拡張子の許可リストとサイズ上限で制限する。
- S3 のバケットは「パブリックアクセスをすべてブロック」にし、Rails 用の IAM ユーザー（またはロール）には対象バケットの読み書きだけを許可する。
- 本番は HTTPS のみ（`config.force_ssl`）とし、Rails の `config.hosts` で受け付けるホストを限定する。
- 現在はログイン機能がない（1人で使う前提）。公開範囲を広げるときは、認証と教材ごとのアクセス確認を追加する。

## 7. デプロイ方針

- Next.js は Vercel、Rails は Render の Docker の Web Service（`backend/Dockerfile`、`render.yaml`）、DB は Render Postgres、ファイルは S3 に置く。
- 手順は [本番環境への移行手順](deployment.md)、候補の比較は [本番環境ガイド（PDF）](deployment-guide.pdf) を参照。
