# API設計：Material Organization

## 1. 基本仕様

- ベースパス：`/api`
- 通常のデータ形式：JSON
- ファイルアップロード形式：multipart/form-data
- 文字コード：UTF-8

## 2. エンドポイント一覧

| メソッド | パス               | 用途           |
| -------- | ------------------ | -------------- |
| GET      | /api/subjects      | 科目一覧       |
| POST     | /api/subjects      | 科目登録       |
| PATCH    | /api/subjects/:id  | 科目更新       |
| DELETE   | /api/subjects/:id  | 科目削除       |
| GET      | /api/documents     | 資料一覧・検索 |
| GET      | /api/documents/:id | 資料詳細       |
| POST     | /api/documents     | 資料登録       |
| PATCH    | /api/documents/:id | 資料更新       |
| DELETE   | /api/documents/:id | 資料削除       |

## 3. 科目一覧

### リクエスト

`GET /api/subjects`

### 成功レスポンス：200 OK

```json
{
  "subjects": [
    {
      "id": 1,
      "name": "データベース",
      "academic_year": 2026,
      "semester": "前期"
    }
  ]
}
```

## 4. 科目登録

### リクエスト

`POST /api/subjects`

```json
{
  "subject": {
    "name": "データベース",
    "academic_year": 2026,
    "semester": "前期"
  }
}
```

### 成功レスポンス：201 Created

登録した科目情報を返す。

### エラー

- 422 Unprocessable Entity：入力値が不正

## 5. 資料一覧・検索

### リクエスト

`GET /api/documents`

### クエリパラメータ

- `q`：タイトルの検索文字列
- `subject_id`：科目ID
- `document_type`：資料種別
- `sort`：`created_at_desc` または `lecture_date_desc`

### リクエスト例

`GET /api/documents?q=正規化&subject_id=1`

### 成功レスポンス：200 OK

```json
{
  "documents": [
    {
      "id": 10,
      "subject_id": 1,
      "subject_name": "データベース",
      "title": "第3回 正規化",
      "description": "正規化の講義資料",
      "document_type": "lecture_material",
      "lecture_date": "2026-10-01",
      "tags": "試験範囲,重要",
      "created_at": "2026-10-18T10:00:00Z",
      "file": {
        "filename": "normalization.pdf",
        "content_type": "application/pdf",
        "url": "/api/documents/10/file"
      }
    }
  ]
}
```

## 6. 資料詳細

### リクエスト

`GET /api/documents/:id`

### 成功レスポンス

資料情報と添付ファイル情報を返す。

### エラー

- 404 Not Found：資料が存在しない
- 401 Unauthorized：認証が必要
- 403 Forbidden：アクセス権限がない

## 7. 資料登録

### リクエスト

`POST /api/documents`

Content-Typeはmultipart/form-dataとする。

### 送信項目

- `document[title]`
- `document[subject_id]`
- `document[description]`
- `document[document_type]`
- `document[lecture_date]`
- `document[tags]`
- `document[file]`

### 成功レスポンス

201 Createdと登録した資料情報を返す。

### エラー

- 400 Bad Request：リクエスト形式が不正
- 422 Unprocessable Entity：入力値・ファイルが不正

## 8. 資料更新

### リクエスト

`PATCH /api/documents/:id`

資料情報を更新する。ファイルも更新する場合はmultipart/form-dataを使用する。

### 成功レスポンス

200 OKと更新後の資料情報を返す。

### エラー

- 404 Not Found：資料が存在しない
- 422 Unprocessable Entity：入力値が不正

## 9. 資料削除

### リクエスト

`DELETE /api/documents/:id`

### 成功レスポンス

204 No Content

### エラー

- 404 Not Found：資料が存在しない
- 401 Unauthorized：認証が必要
- 403 Forbidden：アクセス権限がない

## 10. エラーレスポンス

```json
{
  "error": {
    "code": "validation_error",
    "message": "入力内容を確認してください。",
    "details": {
      "title": ["を入力してください"]
    }
  }
}
```

## 11. 実装上の注意

- 上記は設計上の仕様であり、実装時にRailsのルーティングやシリアライズ方式と整合させる。
- ファイルURLは実装する配信方式に合わせて変更する。
- 認証・認可を導入した後は、各APIで権限を確認する。
- ファイルアップロードの最大サイズ、許可形式、エラー内容をサーバー側で検証する。
- 一覧APIは必要に応じてページネーションを追加する。
