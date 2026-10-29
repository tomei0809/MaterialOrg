# データベース設計：Material Organization

テーブルと関連の図は [ER図](er-diagram.md) を参照してください。
この文書は `backend/db/schema.rb`（version 2026_10_29_164010）と各モデルの検証に合わせています。

## 1. 目的

講義資料（教材）を、フォルダ・まとめ・タグで整理して保存し、検索・絞り込み・並び替え・「お気に入り」「最近使った資料」を実現する。

## 2. テーブル構成

| テーブル | 役割 |
|---|---|
| `users` | 利用者（メールアドレスとパスワード） |
| `sessions` | ログイン中の端末 |
| `materials` | 教材（資料1件） |
| `folders` | フォルダ。`parent_id` で階層を作る（最大5階層） |
| `bundles` | まとめ（複数の教材を1つに束ねる） |
| `tags` | タグ |
| `material_tags` | 教材とタグの中間テーブル |
| `active_storage_*` | 添付ファイル（Rails の Active Storage が管理） |

当初設計の `subjects`（科目）と `documents` は廃止した。科目・学期・単元は、利用者が作るフォルダの階層で表す。

教材・フォルダ・まとめ・タグは `user_id` で利用者ごとに持ち、ほかの利用者とは共有しない。

### users

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | 主キー | 利用者ID |
| email_address | string | 必須・一意・小文字で保存 | ログインに使うメールアドレス |
| password_digest | string | 必須 | パスワードのハッシュ（bcrypt。`has_secure_password`） |
| created_at / updated_at | datetime | 必須 | |

- パスワードは8文字以上。登録できる人数は環境変数 `MAX_USERS`（既定 10）まで。
- パスワード再設定のトークンは DB に保存せず、Rails の署名付きトークン（15分で失効、パスワードを変えると無効）を使う。

### sessions

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | 主キー | 署名付き Cookie `session_id` の値 |
| user_id | bigint | 外部キー・必須 | 利用者 |
| ip_address / user_agent | string | | ログインした端末の情報 |
| created_at / updated_at | datetime | 必須 | 作成から2週間で期限切れ |

### 各テーブルの user_id

`materials`・`folders`・`bundles`・`tags` に `user_id`（外部キー・インデックス）を持つ。
ログイン機能より前に作られたデータは `user_id` が NULL で、どの利用者にも表示されない。`bin/rails users:claim_orphans EMAIL=…` で持ち主を割り当てる。

## 3. materials

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | 主キー | 教材ID |
| title | string | 必須（検証） | タイトル |
| material_type | string | 必須・下の5種のいずれか | 種類 |
| description | text | NULL 可 | 説明 |
| folder_id | bigint | 外部キー・NULL 可・`on_delete: :nullify` | 所属フォルダ（NULL は未分類） |
| bundle_id | bigint | 外部キー・NULL 可・`on_delete: :nullify` | 所属するまとめ |
| bundle_position | integer | NULL 可 | まとめの中の並び順 |
| favorited_at | datetime | NULL 可・インデックス | お気に入りに入れた日時 |
| last_opened_at | datetime | NULL 可・インデックス | 最後に開いた日時 |
| deleted_at | datetime | NULL 可・インデックス | ゴミ箱に入れた日時（NULL はゴミ箱に入っていない） |
| created_at / updated_at | datetime | 必須 | 登録・更新日時 |

- `material_type`：`slide`（講義スライド）・`assignment`（課題）・`past_exam`（過去問）・`notes`（ノート）・`other`（その他）
- 添付ファイル：`has_one_attached :file`。500MB まで。拡張子は許可リスト（PDF・Office・画像・動画・音声・コード・ZIP）に限る。
- タグ：1教材あたり10個まで。タグ名は30文字以内。
- ゴミ箱：`deleted_at` が入っている教材は、一覧・フォルダとタグの件数・一括操作の対象から外す（スコープ `Material.kept` / `Material.trashed`）。30日（`Material::TRASH_RETENTION`）を過ぎたものは `PurgeTrashJob` が毎日完全に削除する。

## 4. folders

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | 主キー | フォルダID |
| name | string | 必須・30文字以内 | フォルダ名 |
| color | string | 必須・既定 `blue` | blue / green / yellow / red / purple / teal / orange / olive / pink / gray |
| parent_id | bigint | 外部キー（folders）・NULL 可 | 親フォルダ（NULL は最上位） |
| position | integer | 必須・既定 0 | 同じ親の中での並び順 |
| created_at / updated_at | datetime | 必須 | |

- `(parent_id, name)` に一意インデックス（`NULLS NOT DISTINCT`）。同じ親の中で同名は作れない。
- 検証：親が存在すること、自分の子孫を親にしない（循環の禁止）、深さが5階層以内。
- 作成時は同じ親の末尾に置く（`before_create :place_at_end`）。

## 5. bundles

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | bigint | 主キー | まとめID |
| name | string | 必須・50文字以内 | まとめの名前 |
| created_at / updated_at | datetime | 必須 | |

- 中身は `materials.bundle_id` と `bundle_position` で表す。中身が空になったまとめは自動で削除する（`Bundle.remove_empty`）。

## 6. tags / material_tags

| テーブル | カラム | 制約 |
|---|---|---|
| tags | name | 必須・30文字以内・一意インデックス |
| material_tags | material_id, tag_id | 外部キー・`(material_id, tag_id)` で一意 |

- 教材の保存時に `tag_names` を渡すと、タグを作成・付け替えする。タグの付け替えと教材の保存は同じトランザクションで行う。

## 7. Active Storage

- `active_storage_blobs` にファイルの名前・形式・サイズ・保存先のキーを、`active_storage_attachments` に教材との関連を保存する。
- 保存先（サービス）は環境で切り替える：開発・テストはローカルディスク（`local` / `test`）、本番は Amazon S3（`amazon`）。
- API はファイルの URL として `rails_storage_proxy_path` を返し、ファイルは Rails を通して配信する（Range リクエストにも対応）。

## 8. インデックス

| テーブル | インデックス |
|---|---|
| materials | user_id、folder_id、bundle_id、favorited_at、last_opened_at、deleted_at |
| folders | user_id、parent_id、(user_id, parent_id, name) 一意 |
| tags | user_id、(user_id, name) 一意 |
| users | email_address 一意 |
| sessions | user_id |
| material_tags | material_id、tag_id、(material_id, tag_id) 一意 |

## 9. 削除時の扱い

| 削除するもの | 扱い |
|---|---|
| 教材（通常の削除） | ゴミ箱へ移す（`deleted_at` を入れる）。フォルダは覚えておき、まとめからは外す。空になったまとめは削除する。30日間は元に戻せる |
| 教材（完全に削除・30日経過） | 教材・タグの関連・添付ファイル（S3 の実体）を削除する |
| フォルダ | 中のサブフォルダと教材は削除せず、1つ上のフォルダ（最上位なら未分類）の末尾へ移す |
| まとめ | まとめだけを解除する。教材は残る |
| タグ | 単独の削除 API はない。使われていないタグは一覧に出さない |

## 10. 今後の拡張候補

- 利用者どうしでの教材の共有
- ファイルのハッシュ値による重複検知
- OCR 結果や全文検索用テキストの保存
- S3 への直接アップロード（大きなファイルの送信を Rails から切り離す）
