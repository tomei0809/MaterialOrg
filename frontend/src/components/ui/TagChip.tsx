type Props = {
  name: string;
  // 指定するとクリックできるタグになる（例：そのタグで絞り込む）
  onClick?: () => void;
  // 指定すると × ボタンを表示する（入力欄の選択済みタグ）
  onRemove?: () => void;
  active?: boolean;
};

const baseClass =
  'inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs';

export function TagChip({ name, onClick, onRemove, active = false }: Props) {
  const colorClass = active
    ? 'border-primary bg-primary text-primary-foreground'
    : 'border-border bg-surface-muted text-foreground';

  const label = (
    <>
      <span className={active ? 'opacity-70' : 'text-muted'} aria-hidden="true">
        #
      </span>
      <span className="truncate">{name}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`「${name}」で絞り込む`}
        className={`${baseClass} ${colorClass} ${
          active ? 'hover:bg-primary-hover' : 'hover:border-primary hover:text-primary'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={`${baseClass} ${colorClass}`}>
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`タグ「${name}」を外す`}
          className="-mr-0.5 ml-0.5 rounded px-0.5 leading-none text-muted hover:bg-border hover:text-foreground"
        >
          ×
        </button>
      )}
    </span>
  );
}
