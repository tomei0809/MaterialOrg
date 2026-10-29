# backend（Rails API）

MaterialOrg の API サーバーです。Ruby on Rails 8.1（API モード）・PostgreSQL・Active Storage（本番は Amazon S3）で動きます。
アプリ全体の説明・起動方法はリポジトリ直下の [README](../README.md) を見てください。

```bash
bundle install
bin/rails db:prepare                 # DB の作成とマイグレーション
bin/rails server                     # http://localhost:3000
bin/rails db:test:prepare test       # テスト
bin/rubocop && bin/brakeman --no-pager
```

| 資料 | 内容 |
|---|---|
| [API仕様書](../docs/api-spec.md) | エンドポイント・リクエスト・レスポンス |
| [ER図](../docs/er-diagram.md) / [DB設計](../docs/database-design.md) | テーブルと関連 |
| [本番環境への移行手順](../docs/deployment.md) | Render（Docker）・Neon・S3 での公開 |
