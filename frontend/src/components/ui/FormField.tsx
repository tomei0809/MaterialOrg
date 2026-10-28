import type { ReactNode } from 'react';

// 入力欄に共通のクラス（input / select / textarea で使う）
export const inputClass =
  'block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

type Props = {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
};

export function FormField({ id, label, required, children }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
        {required && <span className="ml-1 text-xs text-danger">必須</span>}
      </label>
      {children}
    </div>
  );
}
