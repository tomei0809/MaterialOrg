import { TypeIcon } from '@/components/ui/TypeIcon';
import { MATERIAL_TYPES, typeLabels, type MaterialType } from '@/types/material';

type Props = {
  value: MaterialType | 'all';
  // 種類以外の条件で絞った件数
  counts: Record<MaterialType, number>;
  total: number;
  onChange: (value: MaterialType | 'all') => void;
};

// 教材の種類を切り替える上部タブ
export function TypeTabs({ value, counts, total, onChange }: Props) {
  const tabs: { key: MaterialType | 'all'; label: string; count: number }[] = [
    { key: 'all', label: 'すべて', count: total },
    ...MATERIAL_TYPES.map((type) => ({
      key: type,
      label: typeLabels[type],
      count: counts[type],
    })),
  ];

  return (
    <div role="tablist" className="-mb-px flex gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors ${
              active
                ? 'border-primary font-bold text-foreground'
                : 'border-transparent text-muted hover:border-border hover:text-foreground'
            }`}
          >
            {tab.key !== 'all' && <TypeIcon type={tab.key} variant="plain" />}
            {tab.label}
            <span
              className={`rounded px-1.5 text-[11px] tabular-nums ${
                active ? 'bg-primary-soft text-primary' : 'bg-surface-muted text-muted'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
