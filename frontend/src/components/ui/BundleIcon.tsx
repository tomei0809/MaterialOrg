// まとめのアイコン（書類が重なった形。アクセントカラーで塗る）
export function BundleIcon({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 shrink-0 text-primary">
      <rect x="7" y="3" width="13" height="15" rx="2" fill="currentColor" opacity="0.3" />
      <rect x="5" y="5" width="13" height="15" rx="2" fill="currentColor" opacity="0.55" />
      <rect
        x="3"
        y={open ? 8 : 7}
        width="13"
        height="15"
        rx="2"
        fill="currentColor"
      />
      <path d="M6 12h7M6 15h7M6 18h4" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
