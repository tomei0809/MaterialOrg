// お気に入りの星。色はフォルダ専用なので、墨一色で「塗り＝お気に入り」「線＝お気に入りでない」を表す
export function StarIcon({ filled, className = 'size-4' }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 ${className}`}>
      <path
        d="M8 1.6l1.95 4 4.4.62-3.2 3.1.76 4.38L8 11.63 4.09 13.7l.76-4.38-3.2-3.1 4.4-.62z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  favorite: boolean;
  title: string;
  onToggle: () => void;
  // 一覧の行では、お気に入りでないときはカーソルを合わせたときだけ出す
  hideUntilHover?: boolean;
  className?: string;
};

export function FavoriteButton({ favorite, title, onToggle, hideUntilHover = false, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={favorite}
      aria-label={favorite ? `「${title}」をお気に入りから外す` : `「${title}」をお気に入りに追加`}
      title={favorite ? 'お気に入りから外す（F キー）' : 'お気に入りに追加（F キー）'}
      className={`rounded p-0.5 hover:bg-surface-muted ${
        favorite ? 'text-foreground' : 'text-muted hover:text-foreground'
      } ${hideUntilHover && !favorite ? 'opacity-0 group-hover:opacity-100 focus:opacity-100' : ''} ${className}`}
    >
      <StarIcon filled={favorite} />
    </button>
  );
}
