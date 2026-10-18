# データベース設計：Material Organization

## 1. 目的

講義資料と科目の情報を適切に保存し、科目別の検索・一覧表示を実現する。

## 2. テーブル構成

初期開発では、次の2つの業務テーブルを中心に構成する。

- `subjects`：科目情報
- `documents`：資料情報

ファイルの添付情報はActive Storageが管理するテーブルを利用する。

## 3. subjectsテーブル

| カラム        | 型       | 制約     | 説明     |
| ------------- | -------- | -------- | -------- |
| id            | bigint   | 主キー   | 科目ID   |
| name          | string   | NOT NULL | 科目名   |
| academic_year | integer  | NULL許可 | 年度     |
| semester      | string   | NULL許可 | 学期     |
| created_at    | datetime | NOT NULL | 作成日時 |
| updated_at    | datetime | NOT NULL | 更新日時 |

### 補足

- `id` はRailsが自動生成する。
- `name` は必須とする。
- `academic_year` は例として2026を保存する。
- `semester` は「前期」「後期」などを保存する。
- 学期は初期段階では文字列で管理する。

## 4. documentsテーブル

| カラム        | 型       | 制約     | 説明         |
| ------------- | -------- | -------- | ------------ |
| id            | bigint   | 主キー   | 資料ID       |
| subject_id    | bigint   | 外部キー | 所属科目ID   |
| title         | string   | NOT NULL | 資料タイトル |
| description   | text     | NULL許可 | 内容の説明   |
| document_type | string   | NOT NULL | 資料種別     |
| lecture_date  | date     | NULL許可 | 講義日       |
| tags          | string   | NULL許可 | タグ         |
| created_at    | datetime | NOT NULL | 登録日時     |
| updated_at    | datetime | NOT NULL | 更新日時     |

### 補足

- `subject_id` は `subjects.id` を参照する。
- `title` は必須とする。
- `document_type` の値は `lecture_material`、`assignment`、`notes`、`reference`、`other` などを使用する。
- タグは初期段階ではカンマ区切りの文字列などで簡易的に管理する。
- タグの検索要件が増えた場合は、タグ専用テーブルを設ける設計に変更する。
- 資料のファイル本体はdocumentsテーブルに直接保存しない。

## 5. テーブル間の関係

```text
subjects
  id (PK)
   |
   | 1対多
   |
documents
  id (PK)
  subject_id (FK)
   |
   | Active Storageによる添付
   |
  ファイル本体
```

- 1つの科目には複数の資料を登録できる。
- 各資料は1つの科目に所属する。
- 初期段階では科目に所属しない資料は登録しない方針とする。

## 6. Active Storage

RailsのActive Storageを使用し、資料レコードにファイルを関連付ける。

例：

```ruby
class Document < ApplicationRecord
  belongs_to :subject
  has_one_attached :file
end
```

ファイル本体はストレージに保存し、添付に関する情報はActive Storageが管理する。

## 7. インデックス・制約

- documents.subject_idに外部キー制約を設定する。
- documents.subject_idにインデックスを設定する。
- subjects.nameは必須とする。
- documents.titleは必須とする。
- documents.document_typeは許可された値だけを受け付ける。
- 科目の削除時は、所属資料が存在する場合の扱いを明示する。初期仕様では、資料が残っている科目は削除できない方針とする。

## 8. 削除時の扱い

- 資料削除時は、資料レコードと関連ファイルを整合するように削除する。
- 科目削除時は、所属資料が存在する場合は削除を拒否する。
- Active Storageの添付レコードとファイル本体の削除動作を確認する。

## 9. 今後の拡張候補

- tagsテーブルとdocument_tagsテーブルによる多対多関係
- ユーザー管理テーブル
- 資料の公開範囲
- ファイルのハッシュ値による重複検知
- OCR結果や全文検索用テキストの保存

これらは初期開発の必須要件には含めないものとする。
