import { groupByLabels } from '@/lib/grouping';
import { LIST_COLUMN_OPTIONS, type ListColumns } from '@/lib/listColumns';
import {
  GROUP_BY_OPTIONS,
  sortOptions,
  type Density,
  type GroupBy,
  type SortOrder,
} from '@/types/material';

// inputClass は w-full を含むため、横並びのセレクト用に別定義する
const selectClass =
  'rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

type Props = {
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  // フォルダを開いているときはサブフォルダの並びを優先するため、区切りは選べない
  groupByDisabled: boolean;
  // 「最近使った資料」では開いた順に固定するため、並びは選べない
  sortDisabled?: boolean;
  density: Density;
  onDensityChange: (density: Density) => void;
  mapVisible: boolean;
  onToggleMap: () => void;
  // 一覧の列数（広い画面だけで選べる）
  listColumns: ListColumns;
  onListColumnsChange: (columns: ListColumns) => void;
};

// 列数のアイコン：縦の帯を列数だけ並べる
function ColumnsIcon({ count }: { count: number }) {
  const width = (14 - (count - 1) * 1.5) / count;
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
      {Array.from({ length: count }, (_, i) => (
        <rect key={i} x={1 + i * (width + 1.5)} y="2.5" width={width} height="11" rx="1" fill="currentColor" />
      ))}
    </svg>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-border bg-surface p-0.5 text-xs">
      {options.map(([option, text]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-md px-2.5 py-1.5 ${
            value === option ? 'bg-foreground font-bold text-surface' : 'text-muted hover:text-foreground'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// 一覧の表示の操作（区切り・並び・表示密度・マップ）。検索欄は SearchBox
export function Toolbar({
  sortOrder,
  onSortChange,
  groupBy,
  onGroupByChange,
  groupByDisabled,
  sortDisabled = false,
  density,
  onDensityChange,
  mapVisible,
  onToggleMap,
  listColumns,
  onListColumnsChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs text-muted">
        区切り
        <select
          value={groupBy}
          onChange={(event) => onGroupByChange(event.target.value as GroupBy)}
          disabled={groupByDisabled}
          title={
            groupByDisabled
              ? sortDisabled
                ? '最近使った資料は区切らずに開いた順で並びます'
                : 'フォルダを開いているときはフォルダの階層で並びます'
              : undefined
          }
          className={`${selectClass} disabled:opacity-50`}
        >
          {GROUP_BY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {groupByLabels[option]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-xs text-muted">
        並び
        <select
          value={sortOrder}
          onChange={(event) => onSortChange(event.target.value as SortOrder)}
          disabled={sortDisabled}
          title={sortDisabled ? '最近使った資料は開いた順に並びます' : undefined}
          className={`${selectClass} disabled:opacity-50`}
        >
          {sortOptions.map(({ group, options }) => (
            <optgroup key={group} label={group}>
              {options.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {/* スマホでは行が縦に積まれて密度の差が出にくいため、PC 幅のときだけ出す */}
      {/* 列数：狭い画面では1列に固定されるため、広い画面だけで出す */}
      <div role="group" aria-label="一覧の列数" className="ml-auto hidden rounded-lg border border-border bg-surface p-0.5 lg:flex">
        {LIST_COLUMN_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            aria-pressed={listColumns === count}
            onClick={() => onListColumnsChange(count)}
            title={`${count}列で表示`}
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${
              listColumns === count ? 'bg-foreground font-bold text-surface' : 'text-muted hover:text-foreground'
            }`}
          >
            <ColumnsIcon count={count} />
            {count}列
          </button>
        ))}
      </div>

      <div className="hidden sm:block lg:ml-0 sm:ml-auto">
        <Segmented
          label="表示密度"
          value={density}
          options={[
            ['comfortable', '標準'],
            ['compact', '詰める'],
          ] as const}
          onChange={onDensityChange}
        />
      </div>

      <button
        type="button"
        aria-pressed={mapVisible}
        onClick={onToggleMap}
        title={mapVisible ? '資料マップを隠す' : '資料マップを表示'}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs ${
          mapVisible ? 'border-foreground text-foreground' : 'border-border text-muted hover:text-foreground'
        }`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
          <rect x="1.5" y="2.5" width="7" height="11" fill="currentColor" opacity="0.8" />
          <rect x="9.5" y="2.5" width="5" height="6" fill="currentColor" opacity="0.5" />
          <rect x="9.5" y="9.5" width="5" height="4" fill="currentColor" opacity="0.3" />
        </svg>
        マップ
      </button>
    </div>
  );
}
