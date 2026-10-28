// アップロードできるファイル形式の定義と判定
// （backend/app/models/material.rb の FILE_EXTENSIONS・MAX_FILE_SIZE とそろえる）

export const FILE_CATEGORIES = ['document', 'image', 'video', 'audio', 'code', 'archive'] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const FILE_EXTENSIONS: Record<FileCategory, string[]> = {
  document: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'md', 'csv'],
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif', 'svg'],
  video: ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac'],
  code: [
    'py', 'ipynb', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'java', 'c', 'h', 'cpp', 'cc', 'hpp',
    'cs', 'rb', 'go', 'rs', 'php', 'swift', 'kt', 'kts', 'scala', 'r', 'm', 'sql', 'sh', 'bash',
    'ps1', 'bat', 'html', 'htm', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'toml', 'ini',
  ],
  archive: ['zip'],
};

export const fileCategoryLabels: Record<FileCategory, string> = {
  document: '文書',
  image: '画像',
  video: '動画',
  audio: '音声',
  code: 'プログラム',
  archive: 'ZIP',
};

export const MAX_FILE_SIZE = 500 * 1024 * 1024;

// <input type="file" accept="..."> に渡す値
export const ACCEPT_ATTRIBUTE = Object.values(FILE_EXTENSIONS)
  .flat()
  .map((ext) => `.${ext}`)
  .join(',');

export function fileExtension(name: string | null | undefined) {
  const match = name?.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

export function fileCategory(name: string | null | undefined): FileCategory | null {
  const ext = fileExtension(name);
  return FILE_CATEGORIES.find((category) => FILE_EXTENSIONS[category].includes(ext)) ?? null;
}

// 選択されたファイルの事前チェック（最終的な判定はサーバー側でも行う）
export function validateFile(file: File): string | null {
  if (!fileCategory(file.name)) {
    const ext = fileExtension(file.name);
    return `この形式のファイル（${ext ? `.${ext}` : '拡張子なし'}）はアップロードできません。`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `ファイルは${MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください。`;
  }
  return null;
}

// テキストとして中身を表示できるもの（プログラム・テキスト・Markdown・CSV）
export function isTextPreviewable(name: string | null | undefined) {
  const ext = fileExtension(name);
  return fileCategory(name) === 'code' && ext !== 'ipynb'
    ? true
    : ['txt', 'md', 'csv'].includes(ext);
}

// 一覧のバッジに出す形式名（色はフォルダ専用なので、バッジは墨一色で文字だけ変える）
const documentLabels: { exts: string[]; label: string }[] = [
  { exts: ['pdf'], label: 'PDF' },
  { exts: ['ppt', 'pptx', 'odp'], label: 'PPT' },
  { exts: ['doc', 'docx', 'odt', 'rtf'], label: 'DOC' },
  { exts: ['xls', 'xlsx', 'ods', 'csv'], label: 'XLS' },
  { exts: ['txt', 'md'], label: 'TXT' },
];

// 表示用に短くした拡張子（JPEG→JPG、IPYNB→NB など）
const shortLabels: Record<string, string> = { jpeg: 'JPG', ipynb: 'NB', yaml: 'YML', heic: 'HEIC', heif: 'HEIF' };

export function fileBadgeLabel(name: string | null | undefined): string {
  const ext = fileExtension(name);
  const category = fileCategory(name);

  if (category === 'document') {
    const doc = documentLabels.find((d) => d.exts.includes(ext));
    if (doc) return doc.label;
  }
  if (category) return (shortLabels[ext] ?? ext.toUpperCase()).slice(0, 4);
  return 'FILE';
}

// プレビューの見出しに出す言語名
const languageNames: Record<string, string> = {
  py: 'Python', ipynb: 'Jupyter Notebook', js: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript',
  jsx: 'JavaScript (JSX)', ts: 'TypeScript', tsx: 'TypeScript (TSX)', java: 'Java', c: 'C', h: 'C ヘッダー',
  cpp: 'C++', cc: 'C++', hpp: 'C++ ヘッダー', cs: 'C#', rb: 'Ruby', go: 'Go', rs: 'Rust', php: 'PHP',
  swift: 'Swift', kt: 'Kotlin', kts: 'Kotlin Script', scala: 'Scala', r: 'R', m: 'MATLAB / Objective-C',
  sql: 'SQL', sh: 'シェル', bash: 'Bash', ps1: 'PowerShell', bat: 'バッチ', html: 'HTML', htm: 'HTML',
  css: 'CSS', scss: 'SCSS', json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', toml: 'TOML', ini: 'INI',
  txt: 'テキスト', md: 'Markdown', csv: 'CSV',
};

export function languageName(name: string | null | undefined) {
  const ext = fileExtension(name);
  return languageNames[ext] ?? ext.toUpperCase();
}
