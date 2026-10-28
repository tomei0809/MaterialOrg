import { fileBadgeLabel } from '@/lib/fileTypes';

// 添付ファイルの形式を拡張子のバッジで表す（色はフォルダ専用なので墨一色の枠付き文字）
export function FileBadge({ fileName }: { fileName: string | null | undefined }) {
  if (!fileName) return null;

  return (
    <span
      title={fileName}
      className="inline-block w-10 rounded border border-foreground/60 px-1 py-px text-center text-[10px] leading-tight font-bold tracking-wide text-foreground"
    >
      {fileBadgeLabel(fileName)}
    </span>
  );
}
