// 画面にファイルをドラッグしている間だけ出す重ね表示
export function DropOverlay({ target }: { target: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-primary/15 p-6"
    >
      <div className="rounded-xl border-2 border-dashed border-primary bg-surface px-8 py-6 text-center shadow-2xl">
        <p className="text-lg font-bold">ここに離すと教材として登録します</p>
        <p className="mt-1 text-sm text-muted">登録先：{target}（1件なら入力画面、複数なら一括登録）</p>
      </div>
    </div>
  );
}
