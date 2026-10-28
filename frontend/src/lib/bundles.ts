// まとめ（複数の教材を一覧で1行に束ねて表示する）のユーティリティ

import type { Bundle, Material } from '@/types/material';
import { byTitle } from './materialView';

const collator = new Intl.Collator('ja', { numeric: true });

function commonPrefix(values: string[]) {
  let prefix = values[0] ?? '';
  for (const value of values) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}

function commonSuffix(values: string[]) {
  const reversed = values.map((v) => [...v].reverse().join(''));
  return [...commonPrefix(reversed)].reverse().join('');
}

// 選んだ教材名から見出しの候補を作る
//   「講義資料1」…「講義資料10」          → 「講義資料1～10」
//   「情報数学 第1回 講義」…「第5回 講義」 → 「情報数学 第1～5回 講義」
//   前後だけ共通                           → 「線形代数 … 試験（2件）」
//   共通部分がない                         → 「最初の教材名 ほか（n件）」
export function suggestBundleName(titles: string[]): string {
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];

  let prefix = commonPrefix(unique);
  let suffix = commonSuffix(unique.map((t) => t.slice(prefix.length)));
  // 「第1回」と「第10回」のように、共通部分が数字の途中で切れないよう数字を外す
  prefix = prefix.replace(/\d+$/, '');
  suffix = suffix.replace(/^\d+/, '');

  const middles = unique.map((t) => t.slice(prefix.length, t.length - suffix.length));
  if (middles.every((m) => /^\d+$/.test(m))) {
    const numbers = middles.map(Number);
    return `${prefix}${Math.min(...numbers)}～${Math.max(...numbers)}${suffix}`.trim();
  }

  const base = [prefix.trim(), suffix.trim()].filter(Boolean).join(' … ');
  return base ? `${base}（${unique.length}件）` : `${unique[0]} ほか（${unique.length}件）`;
}

// まとめの中の並び順：保存された順番（ドラッグで並び替えたもの）。
// 順番がない教材は後ろに、教材名の自然順（1, 2, …, 10）で並べる
export function sortBundleMembers(members: Material[]) {
  return [...members].sort((a, b) => {
    const pa = a.bundle_position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.bundle_position ?? Number.MAX_SAFE_INTEGER;
    return pa - pb || byTitle(a, b);
  });
}

// id の教材を、target の前（または後ろ）へ移した並び順を返す
export function moveInOrder(order: number[], id: number, targetId: number, after: boolean) {
  const rest = order.filter((x) => x !== id);
  const index = rest.indexOf(targetId);
  if (index < 0) return order;
  rest.splice(after ? index + 1 : index, 0, id);
  return rest;
}

export function compareBundleNames(a: Bundle, b: Bundle) {
  return collator.compare(a.name, b.name);
}

export type GroupedRow =
  | {
      kind: 'bundle';
      bundle: Bundle;
      depth: number;
      // この一覧に表示している（絞り込み後の）中身
      members: Material[];
      expanded: boolean;
    }
  | { kind: 'material'; material: Material; depth: number; inBundle: boolean };

// 並び替え済みの教材のうち、同じまとめに入っているものを1行に束ねる。
// まとめの行は、そのまとめの中で最初に現れた教材の位置に置く。
export function groupIntoBundles(
  sorted: Material[],
  bundles: Map<number, Bundle>,
  expanded: Set<number>,
  depth: number,
): GroupedRow[] {
  const membersByBundle = new Map<number, Material[]>();
  for (const material of sorted) {
    if (material.bundle_id === null || !bundles.has(material.bundle_id)) continue;
    const list = membersByBundle.get(material.bundle_id) ?? [];
    list.push(material);
    membersByBundle.set(material.bundle_id, list);
  }

  const rows: GroupedRow[] = [];
  const emitted = new Set<number>();

  for (const material of sorted) {
    const bundleId = material.bundle_id;
    if (bundleId === null || !bundles.has(bundleId)) {
      rows.push({ kind: 'material', material, depth, inBundle: false });
      continue;
    }
    if (emitted.has(bundleId)) continue;
    emitted.add(bundleId);

    const members = sortBundleMembers(membersByBundle.get(bundleId) ?? []);
    const isExpanded = expanded.has(bundleId);
    rows.push({ kind: 'bundle', bundle: bundles.get(bundleId)!, depth, members, expanded: isExpanded });
    if (isExpanded) {
      for (const member of members) {
        rows.push({ kind: 'material', material: member, depth: depth + 1, inBundle: true });
      }
    }
  }

  return rows;
}
