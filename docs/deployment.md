# 本番環境への移行手順（Vercel ＋ Render 無料プラン ＋ Neon ＋ Amazon S3）

この手順で、画面（Next.js）を Vercel、API（Rails）を Render の無料プラン、PostgreSQL を Neon の無料プラン、添付ファイルを Amazon S3 に置いて公開する。
候補の比較・考え方は [本番環境ガイド（PDF）](deployment-guide.pdf) を参照（PDF は Render の有料プランと Render Postgres を前提に書いた比較資料。実際の手順はこの文書に従う）。

```
ブラウザ ──HTTPS──▶ Vercel（Next.js）──rewrites──▶ Render 無料（Rails API・Docker）──SSL──▶ Neon（PostgreSQL・DB 4つ）
                                                                      └──────────────▶ Amazon S3（非公開バケット）
```

## 今の本番環境（2026-10-29 に公開）

| 役割 | 場所 |
|---|---|
| 画面（Vercel） | https://material-organization.vercel.app |
| API（Render・Web Service・Free・Singapore） | https://materialorg-api.onrender.com（サービス名 `materialorg-api`） |
| DB | Neon（Singapore）。DB 名は既定の `neondb`（cache・queue・cable は `neondb_cache` などが自動で作られた） |
| ファイル | Amazon S3（東京） |
| CI | GitHub Actions（`main` への push ごとに backend・frontend を検査） |

`main` に push すると、Render と Vercel が自動で再デプロイする。

コード側の準備は済んでいる。

| ファイル | 内容 |
|---|---|
| `backend/Dockerfile` | Rails の本番用イメージ（Render が GitHub から取り込んでビルドする） |
| `backend/config/database.yml` | `DATABASE_URL` だけで cache・queue・cable の DB も決まる（DB 名に `_cache` などを付ける） |
| `backend/config/storage.yml` | `amazon`（S3）を環境変数から設定 |
| `backend/config/environments/production.rb` | 保存先 S3、HTTPS 扱い、`APP_HOST` によるホストの制限 |
| `backend/config/cache.yml` | 本番のキャッシュの上限を 64MB に（Neon の無料枠 0.5GB に合わせる） |
| `backend/config/recurring.yml` | ゴミ箱の自動削除（毎日 4:00） |

## 費用と無料プランの制限

| サービス | プラン | 月額 | 主な制限 |
|---|---|---|---|
| Vercel | Hobby | 0円 | 個人・非商用に限る |
| Render（Rails） | Free | 0円 | 15分アクセスがないと休止。次のアクセスで起動し、最初の表示に1分ほどかかる。無料の稼働時間は月750時間（1つなら常時でも収まる）。メモリ 512MB |
| Neon（PostgreSQL） | Free | 0円 | 保存容量 0.5GB／プロジェクト、計算時間 100 CU 時間／月。使われないと5分で休止し、次の接続で数百ミリ秒で再開 |
| Amazon S3 | 従量 | 数十円〜 | 保存量と転送量に応じて課金。無料枠を超えた分が請求される |

料金・制限は 2026年10月時点の目安。各社の公式ページで確かめること。

無料プランで気をつけること：
- Render が休止している間は、ジョブ（ゴミ箱の自動削除など）も止まる。期限を過ぎたゴミ箱の教材は、次にゴミ箱を開いたときにも削除されるので、残り続けることはない。
- Render が起きている間は、ジョブの見回りで Neon も起きたままになる。Render が休止すれば Neon も5分後に休止する。個人で使う程度なら Neon の計算時間（100 CU 時間）に収まる。
- Neon に保存するのは教材の情報だけ（ファイル本体は S3）なので、0.5GB で数万件まで入る。

---

## 0. 事前に用意するもの

- [ ] GitHub にリポジトリを push しておく（Render と Vercel は GitHub から取り込む）
- [ ] AWS アカウント（ルートユーザーに MFA を設定しておく）
- [ ] Neon アカウント（GitHub でサインインできる）
- [ ] Render アカウント（GitHub でサインイン。無料プランでもカードの登録を求められることがある）
- [ ] Vercel アカウント（GitHub でサインイン）
- [ ] `backend/config/master.key` の中身（Rails の秘密情報を開く鍵。リポジトリには入っていない）

> **注意**：`master.key`、AWS のアクセスキー、Neon の接続文字列（パスワードを含む）は、チャット・メール・リポジトリに貼らない。各サービスの「環境変数（Secret）」の欄にだけ入れる。

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

## 2. Neon（PostgreSQL）

### 2.1 プロジェクトを作る

1. https://console.neon.tech → 「New Project」
2. 設定
   - Project name：`materialorg`
   - Postgres version：17
   - Cloud provider / Region：**AWS Asia Pacific (Singapore) ap-southeast-1**（Render の Singapore と近い場所）
   - Database name：`materialorg_production`（既定の `neondb` のままでもよい。その場合は以下の DB 名を `neondb` に読み替える）
3. 「Create」

### 2.2 接続文字列を控える

1. プロジェクトの Dashboard →「Connect」
2. **Connection pooling をオフ**にした（ホスト名に `-pooler` が付かない）接続文字列をコピーする
   - 例：`postgresql://neondb_owner:********@ep-xxxx-xxxx.ap-southeast-1.aws.neon.tech/materialorg_production?sslmode=require&channel_binding=require`
   - pooler 付き（PgBouncer のトランザクションモード）は、Rails のマイグレーションや準備済みの SQL と相性が悪いため使わない
3. これが `DATABASE_URL`（以下 `<NEON_URL>`）

### 2.3 cache・queue・cable の DB（通常は自動）

Rails は起動時の `db:prepare` で、`<NEON_URL>` の DB 名に接尾辞を付けた次の3つを自動で作る。Neon の既定のユーザー（`neondb_owner`）は DB を作れるので、通常は何もしなくてよい。

- `materialorg_production_cache`（Solid Cache）
- `materialorg_production_queue`（Solid Queue：ジョブ）
- `materialorg_production_cable`（Solid Cable）

> 起動ログに `permission denied to create database` が出たときは、Neon の Dashboard →「Databases」→「New Database」で上の3つを、Owner を `neondb_owner` にして作ってから、Render で「Manual Deploy → Deploy latest commit」する。

## 3. Render（Rails API・Web Service の無料プラン）

Render の画面で **New → Web Service** から作る（Blueprint は使わない。Blueprint からの作成では無料のインスタンスを選べないことがあったため）。

### 3.1 Web Service を作る

1. Render のダッシュボード → **New → Web Service**
2. 「Git Provider」で GitHub をつなぎ、リポジトリ `MaterialOrganization` を選んで「Connect」
3. 基本の設定

| 項目 | 設定する値 |
|---|---|
| Name | `materialorg-api`（URL の一部になる） |
| Language | **Docker** |
| Branch | `main` |
| Region | **Singapore (Southeast Asia)**（Neon と同じ地域） |
| Root Directory | `backend` |
| Dockerfile Path | `./Dockerfile`（Root Directory からの位置。画面では前に `backend/` が付いて表示される） |
| Docker Build Context Directory | `.`（同じく `backend/` からの位置） |
| **Instance Type** | **Free**（$0 / month・512 MB・0.1 CPU） |

> Instance Type の一覧に **Free** が出ないときは、ワークスペースの設定や支払い方法の状態で表示が変わっていることがある。Render の **Billing** を開き、無料のインスタンスが使えるワークスペース（Hobby）かを確かめる。Free は Web Service だけで選べる（Background Worker・Cron Job・Private Service では選べない）。

4. **Environment Variables**（「Add Environment Variable」で1つずつ。秘密の値もここに入れてよい。画面上で伏せ字になる）

| キー | 値 |
|---|---|
| `DATABASE_URL` | 2.2 の `<NEON_URL>` |
| `RAILS_MASTER_KEY` | `backend/config/master.key` の中身（32文字） |
| `AWS_ACCESS_KEY_ID` | 1.2 で控えたアクセスキー ID |
| `AWS_SECRET_ACCESS_KEY` | 1.2 で控えたシークレットアクセスキー |
| `S3_BUCKET` | 1.1 のバケット名 |
| `AWS_REGION` | `ap-northeast-1` |
| `SOLID_QUEUE_IN_PUMA` | `true`（添付の削除・ゴミ箱の自動削除のジョブを Puma の中で動かす） |
| `RAILS_MAX_THREADS` | `3`（無料プランのメモリ 512MB に合わせて少なめに） |
| `RAILS_LOG_LEVEL` | `info` |
| `WEB_CONCURRENCY` | `0`（Puma を1プロセスで動かしてメモリを節約する。Render は既定で 1 を入れ、余分な親プロセスが増える） |
| `MAX_USERS` | `10`（新規登録できる人数の上限。増やすときはここを変える） |
| `APP_URL` | Vercel の URL（例 `https://material-organization.vercel.app`。末尾の `/` なし。再設定のメールのリンクに使う） |
| `BREVO_API_KEY` | 6. で作る Brevo の API キー（後から入れてよい） |
| `MAIL_FROM` | 6. で確認した送信元（入力の形は 6.3） |

`APP_HOST` は URL が決まってから 5. で入れる。

5. **Advanced** を開いて設定する

| 項目 | 設定する値 |
|---|---|
| Health Check Path | `/up` |
| Docker Command | `./bin/docker-entrypoint ./bin/rails server` |
| Auto-Deploy | On Commit（`main` に push すると自動で再デプロイ） |

> Docker Command は `./bin/docker-entrypoint ./bin/rails server` にする。
> Render の Docker Command は Dockerfile の ENTRYPOINT（`bin/docker-entrypoint`）ごと置き換えるため、`./bin/rails server` だけにすると、起動前の `db:prepare`（DB の作成とマイグレーション）が実行されない。
> その場合 `Database not found: ..._queue` で起動直後に落ちる（2026-10-29 の初回デプロイで実際に起きた）。
> `bin/docker-entrypoint` は、最後の2語が `./bin/rails server` のときだけ `db:prepare` を実行するので、後ろに `-b 0.0.0.0` や `-p ...` を付け足さない。
> Puma は Render が渡す環境変数 `PORT` の番号で待ち受けるので、ポートの指定は要らない。

6. 「**Deploy Web Service**」を押す

### 3.2 起動を確かめる

1. 「Logs」でビルドと起動を見守る（初回はイメージのビルドに 5〜10 分）
   - `db:prepare` が Neon に4つの DB とテーブルを作る（`materialorg_production`・`_cache`・`_queue`・`_cable`）
   - 最後に `Listening on http://0.0.0.0:10000` のような行が出て「Live」になれば起動完了
2. 画面上部の URL（例 `https://materialorg-api.onrender.com`）を控える。以下 `<API_URL>`
3. ブラウザで確認：`<API_URL>/up` が緑の画面（200）、`<API_URL>/api/v1/folders` が `[]`
4. Neon の「Tables」に `materials` などが見える

設定を後から変えるときは、サービスの **Environment**（環境変数）・**Settings**（Docker Command・Health Check など）で変える。保存すると自動で再デプロイされる。手で再デプロイするときは右上の **Manual Deploy → Deploy latest commit**。

## 4. Vercel（Next.js）

1. Vercel のダッシュボード → **Add New → Project** → 同じリポジトリを Import
2. 設定
   - **Root Directory：`frontend`**（Framework Preset は Next.js が自動で選ばれる）
   - **Environment Variables**：`RAILS_API_URL` ＝ `<API_URL>`（末尾に `/` を付けない）。Production と Preview の両方
3. 「Deploy」。完了すると `https://<project>.vercel.app` が発行される（以下 `<WEB_URL>`）

> `RAILS_API_URL` は**ビルド時**に rewrites へ埋め込まれる。値を変えたら「Redeploy」が必要。

## 5. ホスト名の制限を有効にする

Render の `materialorg-api` → **Environment** → 「Add Environment Variable」で `APP_HOST` を追加し、**Render のホスト名と Vercel のホスト名の両方**をカンマ区切りで入れて保存する（自動で再デプロイされる）。

```
materialorg-api.onrender.com,material-organization.vercel.app
```

- 1つ目：`<API_URL>` のホスト名（Render。直接 `/up` などを開くとき用）
- 2つ目：`<WEB_URL>` のホスト名（Vercel。`https://` と末尾の `/` は付けない）

> Vercel の rewrites は、Rails へ転送するときに元のホスト名を `X-Forwarded-Host` で伝える。Rails はこの名前でホストを確かめるため、Render のホスト名だけを入れると、画面からの API がすべて 403 になる（ログに `Blocked hosts: material-organization.vercel.app`）。
> 独自ドメインを付けたら、そのホスト名も足す。Vercel のプレビュー用の URL（`…-git-….vercel.app`）から試すときも、そのホスト名を足す。

## 6. パスワード再設定のメール（Brevo）

パスワードを忘れたときの再設定のリンクを、Brevo（https://www.brevo.com）の API で送る。
Render の無料プランは SMTP のポート（25・465・587）を使えないため、HTTPS で送れる Brevo を使う。無料プランは1日300通まで。

### 6.1 送信元のアドレスを確認する

1. Brevo に無料で登録する
2. **Senders, Domains & Dedicated IPs → Senders** →「Add a sender」で送信元のメールアドレスを登録し、届いた確認メールのリンクを開く（状態が Verified になる）
   - 独自ドメインがない場合は、自分の Gmail などのアドレスでよい。ただし受け取り側で迷惑メールに入りやすいので、初めて使う人には迷惑メールのフォルダも確かめてもらう

### 6.2 API キーを作る

1. 右上のアカウント名 → **SMTP & API** → **API Keys** タブ →「**Generate a new API key**」
2. **API key name** に用途の分かる名前を入れる（例 `materialorg-render`）
   - 種類を選ぶ画面が出たら、**SMTP key ではなく API key** を選ぶ（アプリは HTTPS の API で送るため）
3. 「Generate」で表示されたキー（`xkeysib-` で始まる）をすぐにコピーする。全体が見られるのはこの画面だけ。チャットやリポジトリには貼らない
4. **IP の制限を確かめる**：右上のアカウント名 → **Security** → **Authorised IPs**
   - 登録した IP 以外からの API の利用を止める設定が有効だと、Render からの送信が拒否される（Render の無料プランは送信元の IP が決まっていない）
   - 制限を無効にするか、Render の `materialorg-api` の **Connect → Outbound** に出ている IP の範囲をすべて登録する

### 6.3 Render に入れる

Render の `materialorg-api` → **Environment** で3つを入れ、「Save Changes」を押す（自動で再デプロイされる）。

| Key | Value |
|---|---|
| `BREVO_API_KEY` | 6.2 でコピーしたキー |
| `MAIL_FROM` | `MaterialOrg <確認したアドレス>`（例 `MaterialOrg <taro@gmail.com>`） |
| `APP_URL` | `https://material-organization.vercel.app`（末尾の `/` なし） |

`MAIL_FROM` の入れ方：
- アドレスは 6.1 で Verified になったものと完全に同じにする（違うと送信が拒否される）
- アドレスを半角の `<` `>` で囲む。`"` や `'` は付けない
- `MaterialOrg` の部分は受け取った人に表示される差出人の名前。好きな名前でよい。アドレスだけ（`taro@gmail.com`）でも送れる（差出人の名前は MaterialOrg になる）

### 6.4 確かめる

再デプロイが終わったら、ログイン画面の「パスワードを忘れた方」で自分のアドレスを入れ、メールが届くこと（迷惑メールのフォルダも）、リンクから新しいパスワードを設定できることを確かめる。

> `BREVO_API_KEY` が空のときは、メールは送られず捨てられる（再設定の画面は「送りました」と表示される）。

## 7. 公開後の確認

`<WEB_URL>` を開いて、上から順に確認する。Render が休止していると最初の表示に1分ほどかかる（一覧が「読み込み中」のまま待つ）。

| # | 確認すること | 期待する結果 |
|---|---|---|
| 1 | 画面が開く | ログイン画面が出る。「新規登録」で自分のアカウントを作ると、空の一覧が出る（Network で `/api/v1/materials` が 200） |
| 2 | フォルダを作る | サイドバーとマップに出る。再読み込みしても残る |
| 3 | 小さな PDF（1MB 程度）を登録 | 一覧に出る。S3 のバケットにオブジェクトが増え、Neon の `active_storage_blobs` に行が増える |
| 4 | ビューアで開く | PDF が表示される。S3 のオブジェクトの URL を直接開くと AccessDenied（非公開） |
| 5 | 動画・音声を登録して位置を移す | その位置から再生される（Network で 206） |
| 6 | 大きなファイル（10MB・100MB） | 登録できる。**413 などで失敗したら 8. を参照** |
| 7 | 教材をゴミ箱へ → 元に戻す | 一覧から消えて戻る。ゴミ箱で「完全に削除」すると、少し後に S3 のオブジェクトも消える |
| 8 | 20分ほど放置してから開き直す | 1分ほどで表示される（Render の休止からの起動）。データは残っている |
| 9 | Render のログ | `Completed 200` が並び、エラーがない |
| 10 | 別のブラウザ（シークレットウィンドウ）で別の人として登録 | 1人目の教材は見えない |
| 11 | 「パスワードを忘れた方」で自分のアドレスを入れる | 再設定のメールが届き、リンクから新しいパスワードを設定できる |

## 8. うまくいかないとき

| 症状 | 見る場所・対処 |
|---|---|
| 画面は開くが一覧が「読み込めません」 | Render が起動中なら1分待って再読み込み。直らなければ Vercel の `RAILS_API_URL` が `<API_URL>` と一致しているか（`https://`・末尾の `/`）。変えたら Redeploy |
| 画面の API が 403・ログに `Blocked hosts: ….vercel.app` | Render の `APP_HOST` に Vercel のホスト名（ログに出ている名前）も入っているか（5. を参照） |
| Render のデプロイが失敗 | Render → Logs。`RAILS_MASTER_KEY` の誤り（`ActiveSupport::MessageEncryptor::InvalidMessage`）、DB の作成権限（2.3 の注意） |
| `No open ports detected`・起動したまま Live にならない | Settings の Docker Command が `./bin/docker-entrypoint ./bin/rails server` になっているか（空だと Thruster が 80 番で起動する） |
| 起動直後に落ちる・`Database not found: neondb_queue`（`_cache`・`_cable` も同様） | `db:prepare` が実行されていない。Settings の Docker Command を `./bin/docker-entrypoint ./bin/rails server` に直して Manual Deploy。DB を作る権限がなければ 2.3 のとおり Neon で作る |
| テーブルがない（`relation "materials" does not exist`） | 同上（`db:prepare` が実行されていない） |
| `PG::ConnectionBad`・`could not translate host name` | `DATABASE_URL` が Neon の Direct の接続文字列か（`-pooler` が付いていないか）、`sslmode=require` が付いているか |
| `prepared statement ... does not exist` | pooler 付きの接続文字列を使っている。2.2 の Direct の方に替える |
| 登録で 500・`Aws::S3::Errors::AccessDenied` | IAM ポリシーのバケット名、`S3_BUCKET`、リージョン |
| 大きなファイルだけ失敗（413 など） | Vercel の転送経路の上限。小さなファイルで運用するか、[本番環境ガイド](deployment-guide.pdf) 7.3 の「S3 への直接アップロード」を実装する |
| Render が `Out of memory` で再起動する | 無料プランは 512MB。Environment で `RAILS_MAX_THREADS` を 2 に下げる。続くなら Settings の Instance Type を有料（Starter 以上）に変える |
| ログインしてもすぐログイン画面に戻る | Rails の本番は Cookie を `Secure` で付ける。Vercel の URL が `https://` か、Render の `APP_HOST` に Vercel のホスト名が入っているか（403 になっていないか） |
| 再設定のメールが届かない | Render の Logs で `Brevo へのメール送信に失敗しました` を探す。`401`・`unrecognised IP` なら 6.2 の Authorised IPs、`sender` を含む誤りなら `MAIL_FROM` が Verified のアドレスと同じか、キーの誤りなら `BREVO_API_KEY`。ログに何も出なければ `BREVO_API_KEY` が空。迷惑メールのフォルダも確かめる |
| 新規登録で「上限に達している」 | Render の Environment で `MAX_USERS` を増やす |
| Neon の容量・計算時間の警告 | Neon の Dashboard → Usage。ゴミ箱を空にする、古い教材を整理する。足りなければ Neon の有料プラン |

## 9. その後の運用

- `main` に push すると、Render と Vercel が自動で再デプロイする（マイグレーションは起動時の `db:prepare` で実行）。
- GitHub Actions の CI が通ったものだけをマージする。
- ゴミ箱は30日を過ぎたものが毎日 4:00 に自動で完全に削除される（Render が休止中なら、次にゴミ箱を開いたときに削除される）。
- 利用者：誰でも新規登録できる（`MAX_USERS` 人まで）。データは各自のもので共有されない。人数を増やすときは `MAX_USERS` を変える。
- バックアップ：Neon の無料プランは、一定期間内の任意の時点へ戻せる（Restore）。期間は公式ページで確かめる。S3 はバージョニングで誤削除に備える。
- 有料へ移るとき：Render はサービスの Settings → Instance Type を変えるだけ。Neon は Billing からプランを変える。DB の移し替えは不要。
