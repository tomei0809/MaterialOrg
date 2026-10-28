# API仕様書：Material Organization

`backend/config/routes.rb` と `backend/app/controllers/api/v1/*` の実装に合わせた仕様です。

## 1. 基本仕様

| 項目 | 内容 |
|---|---|
| ベースパス | `/api/v1` |
| 呼び出し元 | ブラウザ → Next.js（同じオリジン）→ rewrites で Rails へ転送 |
| データ形式 | JSON（`Content-Type: application/json`）。教材の登録・更新だけ `multipart/form-data` |
| 文字コード | UTF-8 |
| 認証 | なし（1人で使う前提。公開範囲を広げるときに追加する） |
| 日時 | ISO 8601（例 `2026-10-27T12:00:00.000+09:00`） |

### 1.1 エラーの形

| ステータス | 場面 | 本文 |
|---|---|---|
| 422 Unprocessable Entity | 検証エラー | `{ "errors": ["タイトルを入力してください"] }` |
| 404 Not Found | ID の対象がない | Rails 標準（本文は空または HTML。画面では「見つかりません」として扱う） |
| 500 Internal Server Error | 想定外のエラー | Rails 標準 |

### 1.2 その他

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/up` | 死活監視（起動していれば 200） |
| GET | `/rails/active_storage/blobs/proxy/:signed_id/:filename` | 添付ファイルの配信（`file_url` の値）。Range リクエスト対応 |

## 2. エンドポイント一覧

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/v1/materials` | 教材一覧・検索（ゴミ箱の教材は含まない） |
| POST | `/api/v1/materials` | 教材の登録（ファイル付き） |
| PATCH | `/api/v1/materials/:id` | 教材の更新 |
| DELETE | `/api/v1/materials/:id` | 教材をゴミ箱へ移す |
| GET | `/api/v1/materials/trash` | ゴミ箱の一覧 |
| PATCH | `/api/v1/materials/restore` | ゴミ箱から元に戻す |
| DELETE | `/api/v1/materials/purge` | ゴミ箱の教材を完全に削除 |
| PATCH | `/api/v1/materials/move` | 複数の教材をフォルダへ移動 |
| PATCH | `/api/v1/materials/assign_bundle` | 複数の教材をまとめに入れる／外す |
| PATCH | `/api/v1/materials/favorite` | お気に入りに入れる／外す |
| PATCH | `/api/v1/materials/:id/opened` | 開いたことを記録（最近使った資料） |
| GET | `/api/v1/folders` | フォルダ一覧 |
| POST | `/api/v1/folders` | フォルダの作成 |
| PATCH | `/api/v1/folders/:id` | フォルダの更新（名前・色・親） |
| DELETE | `/api/v1/folders/:id` | フォルダの削除 |
| PATCH | `/api/v1/folders/arrange` | フォルダの並び替え・別のフォルダへの移動 |
| GET | `/api/v1/bundles` | まとめ一覧 |
| POST | `/api/v1/bundles` | まとめの作成 |
| PATCH | `/api/v1/bundles/:id` | まとめの名前の変更 |
| PATCH | `/api/v1/bundles/:id/reorder` | まとめの中の並び替え |
| DELETE | `/api/v1/bundles/:id` | まとめの解除 |
| GET | `/api/v1/tags` | タグ一覧 |

---

## 3. 教材（materials）

### 3.1 教材のオブジェクト

```json
{
  "id": 12,
  "title": "線形代数 第3回 講義スライド",
  "material_type": "slide",
  "description": "行列の積",
  "folder_id": 5,
  "bundle_id": null,
  "bundle_position": null,
  "favorited_at": "2026-10-27T10:00:00.000+09:00",
  "last_opened_at": null,
  "deleted_at": null,
  "created_at": "2026-10-20T09:00:00.000+09:00",
  "updated_at": "2026-10-21T09:00:00.000+09:00",
  "tags": ["試験対策", "重要"],
  "file_attached": true,
  "file_url": "/rails/active_storage/blobs/proxy/eyJfcmFpbHMi.../lecture03.pdf",
  "file_name": "lecture03.pdf",
  "file_size": 2345678,
  "file_content_type": "application/pdf",
  "purge_at": null
}
```

| 項目 | 説明 |
|---|---|
| material_type | `slide` 講義スライド / `assignment` 課題 / `past_exam` 過去問 / `notes` ノート / `other` その他 |
| folder_id | 所属フォルダ。`null` は未分類 |
| bundle_id・bundle_position | 所属するまとめと、その中の並び順 |
| favorited_at | `null` でなければお気に入り（入れた日時） |
| last_opened_at | 最後に開いた日時 |
| deleted_at・purge_at | ゴミ箱に入れた日時と、完全に削除される日時（入れてから30日後）。ゴミ箱に入っていなければ `null` |
| tags | タグ名（名前順） |
| file_* | 添付がないときは `file_attached: false`、ほかは `null` |

### 3.2 GET /api/v1/materials（一覧・検索）

ゴミ箱に入っていない教材を、新しく登録した順（`created_at` の降順）に返す。並び替え・種類の絞り込み・資料マップの集計は画面側でも行う。

| クエリ | 例 | 説明 |
|---|---|---|
| title | `線形` | タイトルの部分一致（大文字小文字を区別しない） |
| material_type | `past_exam` | 種類で絞り込む |
| folder_id | `5` / `none` | フォルダ直下で絞り込む。`none` は未分類 |
| tag | `試験対策` | タグ名で絞り込む |

```http
GET /api/v1/materials?folder_id=5&tag=試験対策
```

**200 OK**：教材のオブジェクトの配列。

### 3.3 POST /api/v1/materials（登録）

`multipart/form-data` で送る。

| 項目 | 必須 | 説明 |
|---|---|---|
| `material[title]` | ○ | タイトル |
| `material[material_type]` | ○ | 種類（上の5種） |
| `material[description]` | | 説明 |
| `material[folder_id]` | | フォルダ ID。空文字なら未分類 |
| `material[tag_names][]` | | タグ名（複数可。10個まで、各30文字以内） |
| `material[file]` | | ファイル（500MB まで。許可された拡張子のみ） |

```bash
curl -X POST http://localhost:3000/api/v1/materials \
  -F "material[title]=線形代数 第3回" \
  -F "material[material_type]=slide" \
  -F "material[folder_id]=5" \
  -F "material[tag_names][]=試験対策" \
  -F "material[file]=@lecture03.pdf"
```

**201 Created**：登録した教材のオブジェクト。

**422**：検証エラー。例

```json
{ "errors": ["この形式のファイル（.exe）はアップロードできません"] }
```

許可する拡張子：pdf doc docx ppt pptx xls xlsx odt ods odp rtf txt md csv / jpg jpeg png gif webp bmp heic heif svg / mp4 m4v mov webm mkv avi / mp3 m4a aac wav ogg oga flac / py ipynb js ts tsx java c cpp cs rb go rs php swift kt sql sh html css json yaml xml など / zip

### 3.4 PATCH /api/v1/materials/:id（更新）

登録と同じ項目を `multipart/form-data` で送る。`material[file]` を省くと添付はそのまま。タグは送った内容に置き換わる。

**200 OK**：更新後の教材。 **404**：教材がない（ゴミ箱の教材も 404）。 **422**：検証エラー。

### 3.5 DELETE /api/v1/materials/:id（ゴミ箱へ移す）

教材を**ゴミ箱へ移す**（`deleted_at` に現在時刻を入れる）。30日間は 3.10 で元に戻せる。

- 一覧・フォルダの件数・タグの件数・各種の一括操作の対象から外れる。
- フォルダ（`folder_id`）は覚えておき、戻すとそのフォルダに戻る。
- まとめからは外す。中身が空になったまとめは削除する。
- `updated_at` は変えない。

**204 No Content**。 **404**：教材がない、またはすでにゴミ箱にある。

### 3.6 PATCH /api/v1/materials/move（フォルダへ移動）

```json
{ "ids": [12, 13], "folder_id": 5 }
```

`folder_id` を空文字（`""`）にすると未分類へ戻す。

**200 OK**：`{ "moved": 2 }`　**422**：`{ "errors": ["移動先のフォルダが見つかりません"] }`

### 3.7 PATCH /api/v1/materials/assign_bundle（まとめに入れる／外す）

```json
{ "ids": [12, 13], "bundle_id": 3 }
```

まとめに入れるときは末尾に並べる。`bundle_id` を空にすると、まとめから外す。空になったまとめは削除する。

**200 OK**：`{ "updated": 2 }`　**422**：`{ "errors": ["まとめが見つかりません"] }`

### 3.8 PATCH /api/v1/materials/favorite（お気に入り）

```json
{ "ids": [12, 13], "favorite": true }
```

`favorite: false` で外す。すでにお気に入りの教材は、入れた日時をそのまま残す。`updated_at` は変えない。

**200 OK**：`{ "updated": 1 }`（実際に変わった件数）

### 3.9 PATCH /api/v1/materials/:id/opened（開いたことの記録）

本文なし。`last_opened_at` を現在時刻にする。`updated_at` は変えない。

**200 OK**：`{ "id": 12, "last_opened_at": "2026-10-27T12:00:00.000+09:00" }`　**404**：教材がない。

### 3.10 GET /api/v1/materials/trash（ゴミ箱の一覧）

ゴミ箱の教材を、ゴミ箱へ入れた日時の新しい順に返す（教材のオブジェクトの配列。`deleted_at`・`purge_at` が入る）。
呼ばれたときに、30日を過ぎたものを先に完全に削除する（毎日の自動削除が止まっていても残らないように）。

### 3.11 PATCH /api/v1/materials/restore（元に戻す）

```json
{ "ids": [12, 13] }
```

ゴミ箱の教材を元に戻す。元のフォルダが削除されていれば、そのフォルダの親（なければ未分類）に入っている。まとめには戻らない。

**200 OK**：`{ "restored": 2 }`（ゴミ箱に入っていなかった ID は数えない）

### 3.12 DELETE /api/v1/materials/purge（完全に削除）

```json
{ "ids": [12, 13] }
```

または、ゴミ箱を空にするとき

```json
{ "all": true }
```

ゴミ箱の教材を、タグの関連・添付ファイル（S3 の実体を含む）ごと完全に削除する。元に戻せない。ゴミ箱に入っていない教材の ID は無視する。

**200 OK**：`{ "purged": 2 }`

### 3.13 自動削除

ゴミ箱に入れてから30日（`Material::TRASH_RETENTION`）を過ぎた教材は、`PurgeTrashJob` が毎日 4:00 に完全に削除する（`config/recurring.yml`、Solid Queue）。

---

## 4. フォルダ（folders）

### 4.1 フォルダのオブジェクト

```json
{ "id": 5, "name": "線形代数", "color": "purple", "parent_id": 1, "position": 2, "materials_count": 8 }
```

| 項目 | 説明 |
|---|---|
| color | blue / green / yellow / red / purple / teal / orange / olive / pink / gray |
| parent_id | 親フォルダ。`null` は最上位 |
| position | 同じ親の中での並び順（0 から） |
| materials_count | そのフォルダ直下の教材数（サブフォルダとゴミ箱の分は含まない） |

### 4.2 GET /api/v1/folders

空のフォルダも含め、`position` → 名前の順で全件を返す。階層は `parent_id` で組み立てる。

**200 OK**：フォルダのオブジェクトの配列。

### 4.3 POST /api/v1/folders（作成）

```json
{ "folder": { "name": "線形代数", "color": "purple", "parent_id": 1 } }
```

同じ親の末尾に作る。

**201 Created**：作成したフォルダ。 **422**：名前が空・30文字超・同じ親に同名がある・5階層を超える など。

### 4.4 PATCH /api/v1/folders/:id（更新）

本文は作成と同じ（変える項目だけでよい）。`parent_id` を変えると別のフォルダの中へ移る。自分の子孫を親にすることはできない。

**200 OK**：更新後のフォルダ。 **404**／**422**。

### 4.5 DELETE /api/v1/folders/:id（削除）

中のサブフォルダと教材は削除せず、1つ上のフォルダ（最上位なら未分類）の末尾へ移す。

**204 No Content**。 **404**。

### 4.6 PATCH /api/v1/folders/arrange（並び替え・移動）

```json
{ "parent_id": 1, "folder_ids": [8, 5, 6] }
```

`parent_id`（`null` なら最上位）の中を `folder_ids` の順に並べる。別の親にあるフォルダを含めると、そのフォルダはこの親の中へ移る。今その親にある子フォルダは、すべて `folder_ids` に含める必要がある。

**200 OK**：並び替え後のフォルダ一覧（4.2 と同じ形）。 **422**：子フォルダが足りない・循環・階層の超過など。

---

## 5. まとめ（bundles）

### 5.1 まとめのオブジェクト

```json
{ "id": 3, "name": "第2回 板書と資料", "materials_count": 4 }
```

### 5.2 GET /api/v1/bundles

名前順で全件を返す。中身は教材の `bundle_id` と `bundle_position` で組み立てる。

### 5.3 POST /api/v1/bundles（作成）

```json
{ "bundle": { "name": "第2回 板書と資料", "material_ids": [21, 22, 23] } }
```

作成と同時に、渡した順に教材をまとめる。ほかのまとめから移ってきた教材があり、元のまとめが空になれば元は削除する。

**201 Created**。 **422**：`{ "errors": ["まとめる教材を選択してください"] }` など。

### 5.4 PATCH /api/v1/bundles/:id（名前の変更）

```json
{ "bundle": { "name": "第2回 まとめ" } }
```

**200 OK**／**404**／**422**（名前が空・50文字超）。

### 5.5 PATCH /api/v1/bundles/:id/reorder（中の並び替え）

```json
{ "material_ids": [23, 21, 22] }
```

中身すべての ID を新しい順で渡す。

**200 OK**：まとめのオブジェクト。 **422**：`{ "errors": ["並び替える教材が、まとめの中身と一致しません"] }`

### 5.6 DELETE /api/v1/bundles/:id（解除）

まとめだけを削除する。教材は残り、`bundle_id` が `null` になる。

**204 No Content**。

---

## 6. タグ（tags）

### 6.1 GET /api/v1/tags

教材に使われているタグを、使われている数の多い順（同数なら名前順）に返す。使われていないタグ、ゴミ箱の教材だけに付いているタグは返さない。

```json
[
  { "id": 1, "name": "試験対策", "materials_count": 16 },
  { "id": 4, "name": "重要", "materials_count": 16 }
]
```

タグの作成・付け替えは、教材の登録・更新の `material[tag_names][]` で行う。

## 7. 実装上の注意

- 一覧・フォルダ・まとめ・タグは画面を開いたときにまとめて取得し、並び替え・絞り込み・集計は画面側で行う（教材数が数千件程度までを想定）。
- 一括操作（move・assign_bundle・favorite）は `update_all` を使い、1回の SQL で更新する。ゴミ箱の教材は対象にしない。
- お気に入りと開いた記録は `updated_at` を変えない（「更新日順」の並びを崩さないため）。
- 本番でファイルの保存先を S3 にしても、API の形は変わらない（`file_url` は同じ proxy のパス）。
