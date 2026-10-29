# ER図：Material Organization

`backend/db/schema.rb`（version 2026_10_29_164010）をもとにした、テーブルと関連の図です。
各テーブルの列の意味や制約は [データベース設計](database-design.md) にまとめています。

```mermaid
erDiagram
    users ||--o{ sessions : "ログイン"
    users ||--o{ materials : "持つ"
    users ||--o{ folders : "持つ"
    users ||--o{ bundles : "持つ"
    users ||--o{ tags : "持つ"
    folders ||--o{ folders : "親子（parent_id）"
    folders |o--o{ materials : "入れる（folder_id）"
    bundles |o--o{ materials : "まとめる（bundle_id）"
    materials ||--o{ material_tags : ""
    tags ||--o{ material_tags : ""
    materials ||--o| active_storage_attachments : "file（has_one_attached）"
    active_storage_blobs ||--o{ active_storage_attachments : ""
    active_storage_blobs ||--o{ active_storage_variant_records : ""

    users {
        bigint id PK
        string email_address "必須・一意・小文字"
        string password_digest "bcrypt"
        datetime created_at
        datetime updated_at
    }

    sessions {
        bigint id PK "Cookie session_id の値"
        bigint user_id FK
        string ip_address
        string user_agent
        datetime created_at "2週間で期限切れ"
        datetime updated_at
    }

    folders {
        bigint id PK
        bigint user_id FK "持ち主"
        string name "必須・30文字以内・同じ親の中で重複不可"
        string color "10色のいずれか（既定 blue）"
        bigint parent_id FK "NULL は最上位"
        integer position "同じ親の中での並び順"
        datetime created_at
        datetime updated_at
    }

    materials {
        bigint id PK
        bigint user_id FK "持ち主"
        string title "必須"
        string material_type "slide / assignment / past_exam / notes / other"
        text description
        bigint folder_id FK "NULL は未分類"
        bigint bundle_id FK "NULL はまとめなし"
        integer bundle_position "まとめの中の並び順"
        datetime favorited_at "NULL でなければお気に入り"
        datetime last_opened_at "最近使った資料"
        datetime deleted_at "NULL でなければゴミ箱（30日で完全に削除）"
        datetime created_at
        datetime updated_at
    }

    bundles {
        bigint id PK
        bigint user_id FK "持ち主"
        string name "必須・50文字以内"
        datetime created_at
        datetime updated_at
    }

    tags {
        bigint id PK
        bigint user_id FK "持ち主"
        string name "必須・30文字以内・利用者ごとに一意"
        datetime created_at
        datetime updated_at
    }

    material_tags {
        bigint id PK
        bigint material_id FK
        bigint tag_id FK "material_id と組で一意"
        datetime created_at
        datetime updated_at
    }

    active_storage_attachments {
        bigint id PK
        string name "file"
        string record_type "Material"
        bigint record_id
        bigint blob_id FK
        datetime created_at
    }

    active_storage_blobs {
        bigint id PK
        string key "保存先（S3 のオブジェクトキー）"
        string filename
        string content_type
        bigint byte_size "500MB まで"
        string service_name "local / amazon"
        string checksum
        datetime created_at
    }

    active_storage_variant_records {
        bigint id PK
        bigint blob_id FK
        string variation_digest
    }
```

## 関連の要点

| 関連 | 種類 | 削除したときの扱い |
|---|---|---|
| folders → folders（parent_id） | 自己参照の1対多。最大5階層、循環は検証で防ぐ | フォルダを消すと、中のサブフォルダと教材は1つ上のフォルダ（最上位なら未分類）へ移る（`before_destroy`） |
| folders → materials | 1対多（任意） | 外部キーは `on_delete: :nullify`。教材は消えずに未分類になる |
| bundles → materials | 1対多（任意）。`bundle_position` で並ぶ | まとめを解除しても教材は残る（`dependent: :nullify`）。中身が空になったまとめは自動で消す |
| materials ↔ tags | 多対多（material_tags が中間テーブル） | 教材を消すと material_tags も消える。1教材あたりタグは10個まで |
| materials → ファイル | Active Storage の `has_one_attached :file` | 教材を完全に削除すると添付も消える。実体は開発ではディスク、本番では S3 に置く |
| materials（ゴミ箱） | `deleted_at` による論理削除 | 削除するとまずゴミ箱へ（フォルダは保持、まとめからは外れる）。30日後に `PurgeTrashJob` が完全に削除する |

## 設計上の判断

- **データは利用者ごと**：教材・フォルダ・まとめ・タグに `user_id` を持たせ、API はすべて `Current.user` の範囲から探す。タグ名・フォルダ名の重複も利用者ごとに判定する（`(user_id, name)`・`(user_id, parent_id, name)` の一意インデックス）。添付ファイルの配信も、教材の持ち主にだけ許す。

- **科目テーブルを持たない**：初期設計の `subjects` は廃止し、科目はフォルダで表す（`20261024131329_remove_subject_from_materials`）。科目・学期・単元のような入れ子を、利用者が自由に作れるようにするため。
- **お気に入り・最近使ったは日時の列**：真偽値ではなく `favorited_at`・`last_opened_at` にして、「入れた順」「開いた順」に並べられるようにした。更新は `update_all`・`update_columns` で行い、`updated_at`（更新日順の並び替え）を変えない。
- **ゴミ箱は論理削除**：削除をすぐに確定させず `deleted_at` を入れるだけにして、誤って消した教材を30日間は戻せるようにした。添付ファイルの実体も30日間は残るため、S3 の容量は完全に削除するまで減らない。
- **フォルダ名の重複**：`(parent_id, name)` の一意インデックスに `NULLS NOT DISTINCT` を付け、最上位（parent_id が NULL）どうしでも同じ名前を作れないようにしている。
