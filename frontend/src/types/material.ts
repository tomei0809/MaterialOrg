// 教材に関する型と定数（Rails の Material モデルと対応）

export const MATERIAL_TYPES = [
  'slide',
  'assignment',
  'past_exam',
  'notes',
  'other',
] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];

// backend/app/models/material.rb の inclusion と必ずそろえる
export const typeLabels: Record<MaterialType, string> = {
  slide: '講義スライド',
  assignment: '課題',
  past_exam: '過去問',
  notes: 'ノート',
  other: 'その他',
};

// GET /api/v1/materials のレスポンス1件分
export type Material = {
  id: number;
  title: string;
  material_type: MaterialType;
  description: string | null;
  created_at: string;
  updated_at: string;
  tags: string[];
  folder_id: number | null;
  // 一覧で1行にまとめて表示する「まとめ」（保存場所のフォルダとは別）
  bundle_id: number | null;
  // まとめの中での並び順（0 始まり。まとめに入っていなければ null）
  bundle_position: number | null;
  file_attached?: boolean;
  file_url?: string | null;
  file_name?: string | null;
  // バイト数と MIME タイプ（プレビュー・サイズ表示用）
  file_size?: number | null;
  file_content_type?: string | null;
  // お気に入りに入れた日時（null はお気に入りでない）
  favorited_at?: string | null;
  // 最後に開いた日時（「最近使った資料」。null はまだ開いていない）
  last_opened_at?: string | null;
  // ゴミ箱に入れた日時と、完全に削除される日時（ゴミ箱の教材だけ）
  deleted_at?: string | null;
  purge_at?: string | null;
};

// 登録・編集フォームの入力値
export type MaterialFormValues = {
  title: string;
  material_type: MaterialType;
  description: string;
  tags: string[];
  // '' は未分類
  folder_id: string;
};

export const initialFormValues: MaterialFormValues = {
  title: '',
  material_type: 'slide',
  description: '',
  tags: [],
  folder_id: '',
};

export type MaterialFilters = {
  title?: string;
  material_type?: string;
  tag?: string;
};

// backend/app/models/folder.rb の COLORS とそろえる
export const FOLDER_COLORS = [
  'blue',
  'green',
  'yellow',
  'red',
  'purple',
  'teal',
  'orange',
  'olive',
  'pink',
  'gray',
] as const;

export type FolderColor = (typeof FOLDER_COLORS)[number];

// GET /api/v1/folders のレスポンス1件分
export type Folder = {
  id: number;
  name: string;
  color: FolderColor;
  // null は最上位
  parent_id: number | null;
  // 同じ親の中での並び順（ドラッグで並び替える）
  position: number;
  // このフォルダ直下の教材数（サブフォルダの分は含まない）
  materials_count: number;
};

export const MAX_FOLDER_NAME_LENGTH = 30;
// backend/app/models/folder.rb の MAX_DEPTH とそろえる
export const MAX_FOLDER_DEPTH = 5;

// GET /api/v1/bundles のレスポンス1件分
export type Bundle = {
  id: number;
  name: string;
  materials_count: number;
};

// backend/app/models/bundle.rb の MAX_NAME_LENGTH とそろえる
export const MAX_BUNDLE_NAME_LENGTH = 50;

// GET /api/v1/tags のレスポンス1件分
export type Tag = {
  id: number;
  name: string;
  materials_count: number;
};

// backend/app/models/material.rb・tag.rb の上限とそろえる
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

// 入力欄の候補としていつも表示するタグ
export const PRESET_TAGS = ['試験対策', '復習用', '重要', '要確認'];

export type SortOrder =
  | 'created_desc'
  | 'created_asc'
  | 'updated_desc'
  | 'updated_asc'
  | 'title_asc'
  | 'title_desc'
  | 'type_asc'
  | 'tags_desc'
  | 'file_first'
  | 'opened_desc';

// 並び替えの選択肢（group ごとにまとめて表示する）
export const sortOptions: { group: string; options: { value: SortOrder; label: string }[] }[] = [
  {
    group: '日付',
    options: [
      { value: 'created_desc', label: '登録日が新しい順' },
      { value: 'created_asc', label: '登録日が古い順' },
      { value: 'updated_desc', label: '更新日が新しい順' },
      { value: 'updated_asc', label: '更新日が古い順' },
      { value: 'opened_desc', label: '最近開いた順' },
    ],
  },
  {
    group: '名前',
    options: [
      { value: 'title_asc', label: '教材名（昇順）' },
      { value: 'title_desc', label: '教材名（降順）' },
    ],
  },
  {
    group: '分類',
    options: [
      { value: 'type_asc', label: '教材の種類順' },
      { value: 'tags_desc', label: 'タグが多い順' },
      { value: 'file_first', label: 'ファイルありを優先' },
    ],
  },
];

// サイドバーで選ぶ表示範囲
export type Scope =
  | { kind: 'all' }
  | { kind: 'recent' }
  // お気に入り・最近使った資料（開いたことのあるもの）
  | { kind: 'favorites' }
  | { kind: 'opened' }
  | { kind: 'unfiled' }
  | { kind: 'folder'; id: number };

// 一覧の絞り込み条件（すべてブラウザ側で適用する）
export type ViewFilters = {
  scope: Scope;
  type: MaterialType | 'all';
  tag: string | null;
  query: string;
};

export type Density = 'comfortable' | 'compact';

// 一覧の区切り方（lib/grouping.ts）
export const GROUP_BY_OPTIONS = ['folder', 'type', 'none'] as const;
export type GroupBy = (typeof GROUP_BY_OPTIONS)[number];
