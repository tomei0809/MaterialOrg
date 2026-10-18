# 環境構築手順書：Material Organization

## 1. 目的

Ruby on Rails、React、TypeScript、PostgreSQLを使用した開発環境を構築し、フロントエンドとバックエンドが連携できる状態にする。

## 2. 事前準備

以下をインストール・準備する。

- Git
- GitHubアカウント
- Ruby
- RubyGems・Bundler
- Node.js（LTS版を推奨）
- npm
- PostgreSQL
- VS Codeなどのエディタ

Windowsで開発する場合、RubyやPostgreSQLの構築方法を統一しやすくするため、WSL2上のLinux環境を利用する方法も検討する。

## 3. リポジトリ作成

GitHubで `study-vault` リポジトリを作成する。

ローカルにクローンし、作業ディレクトリへ移動する。

```bash
git clone <GitHubリポジトリのURL>
cd study-vault
```

初期ディレクトリを作成する。

```text
study-vault/
├── backend/
├── frontend/
├── docs/
├── .gitignore
└── README.md
```

## 4. Rails APIの構築

### 4.1 Railsアプリの生成

リポジトリのルートディレクトリで実行する。

```bash
rails new backend --api -d postgresql
```

これにより、API専用モードのRailsアプリとPostgreSQL用の設定が生成される。

### 4.2 ディレクトリへ移動

```bash
cd backend
```

### 4.3 データベース作成

PostgreSQLが起動しており、接続設定が正しいことを確認した上で実行する。

```bash
bin/rails db:create
```

### 4.4 サーバー起動

```bash
bin/rails server
```

起動後、ブラウザまたはHTTPクライアントから接続できることを確認する。

### 4.5 Active Storageの準備

プロジェクトのルートで次を実行する。

```bash
bin/rails active_storage:install
bin/rails db:migrate
```

これにより、Active Storageが利用するテーブルを作成する。

### 4.6 CORS設定

フロントエンドとバックエンドを別オリジンで動作させる場合は、許可するオリジンを限定してCORSを設定する。

開発時のフロントエンドURLを許可し、本番環境では本番URLに合わせて変更する。

## 5. React + TypeScriptの構築

リポジトリのルートへ戻る。

```bash
cd ..
```

Viteを使ってReact + TypeScriptプロジェクトを生成する。

```bash
npm create vite@latest frontend -- --template react-ts
```

フロントエンドのディレクトリへ移動し、依存関係をインストールする。

```bash
cd frontend
npm install
```

開発サーバーを起動する。

```bash
npm run dev
```

表示されたローカルURLをブラウザで開き、初期画面が表示されることを確認する。

## 6. フロントエンドとバックエンドの接続

### 6.1 APIの疎通確認

Rails側に動作確認用のエンドポイントを作成する。

例：

```text
GET /api/health
```

正常時にはJSON形式で次のようなレスポンスを返す。

```json
{
  "status": "ok"
}
```

### 6.2 Reactからリクエスト

Reactからfetchなどを利用してエンドポイントへアクセスし、JSONを取得できることを確認する。

```typescript
const response = await fetch('http://localhost:3000/api/health');

if (!response.ok) {
  throw new Error('API request failed');
}

const data = await response.json();
console.log(data);
```

接続先URLは、環境変数などで管理し、本番URLへ変更できるようにする。

## 7. Gitの設定

### 7.1 .gitignore

次のようなファイル・ディレクトリをGit管理から除外する。

- node_modules/
- .env
- .env.local
- ログファイル
- 一時ファイル
- 秘密鍵や認証情報
- 開発用の個人データ

RailsやViteが生成する既存の.gitignoreも確認し、必要な設定を追加する。

### 7.2 初回コミット

```bash
git add .
git commit -m "chore: initialize Rails and React projects"
git push
```

秘密情報や不要な生成物が含まれていないことを確認してからpushする。

## 8. READMEの作成

README.mdに以下を記載する。

- プロジェクトの概要
- 使用技術
- ディレクトリ構成
- 必要なソフトウェア
- バックエンドの起動方法
- フロントエンドの起動方法
- データベースの作成方法
- テスト方法
- 環境変数の設定方法

## 9. 環境構築の完了条件

- Rails APIが起動する。
- PostgreSQLに接続できる。
- React + TypeScriptの画面が表示される。
- ReactからRails APIを呼び出せる。
- Active Storageのテーブルが作成されている。
- GitHubへ安全にソースコードをpushできる。
- READMEに開発環境の起動方法が記載されている。

## 10. 注意事項

- Rails、Ruby、Node.jsのバージョンを記録する。
- PostgreSQLの接続情報をソースコードへ直接記載しない。
- CORSの許可範囲を必要以上に広げない。
- ファイルアップロードを実装したら、許可形式・最大サイズ・権限をサーバー側で検証する。
- 公開環境へデプロイする前に、認証・認可とHTTPSを整備する。
