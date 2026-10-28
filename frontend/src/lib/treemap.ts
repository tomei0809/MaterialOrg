// 面積が値に比例する長方形に分割する（squarified treemap）
// 参考：Bruls, Huizing, van Wijk "Squarified Treemaps"（細長い長方形を避ける並べ方）

export type Rect = { x: number; y: number; width: number; height: number };
export type TreemapItem<T> = { value: number; data: T };
export type TreemapCell<T> = Rect & { data: T; value: number };

// 1列に並べたときの最も細長い長方形の縦横比（小さいほど正方形に近い）
function worstRatio(values: number[], side: number, scale: number) {
  const areas = values.map((v) => v * scale);
  const sum = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  const s2 = side * side;
  return Math.max((s2 * max) / (sum * sum), (sum * sum) / (s2 * min));
}

export function squarify<T>(items: TreemapItem<T>[], bounds: Rect): TreemapCell<T>[] {
  const list = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = list.reduce((sum, item) => sum + item.value, 0);
  if (total === 0 || bounds.width <= 0 || bounds.height <= 0) return [];

  const scale = (bounds.width * bounds.height) / total;
  const cells: TreemapCell<T>[] = [];
  let rect = { ...bounds };
  let row: TreemapItem<T>[] = [];

  // 今の行を、残りの長方形の短い辺に沿って敷き詰める
  const layoutRow = (rowItems: TreemapItem<T>[], last: boolean) => {
    const rowSum = rowItems.reduce((s, item) => s + item.value, 0) * scale;
    const horizontal = rect.width >= rect.height; // 横長なら左端に縦の列を置く
    const thickness = last
      ? horizontal ? rect.width : rect.height
      : rowSum / (horizontal ? rect.height : rect.width);
    let offset = 0;

    for (const item of rowItems) {
      const length = (item.value * scale) / thickness;
      cells.push(
        horizontal
          ? { x: rect.x, y: rect.y + offset, width: thickness, height: length, data: item.data, value: item.value }
          : { x: rect.x + offset, y: rect.y, width: length, height: thickness, data: item.data, value: item.value },
      );
      offset += length;
    }
    rect = horizontal
      ? { x: rect.x + thickness, y: rect.y, width: rect.width - thickness, height: rect.height }
      : { x: rect.x, y: rect.y + thickness, width: rect.width, height: rect.height - thickness };
  };

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const side = Math.min(rect.width, rect.height);
    const values = row.map((r) => r.value);
    if (row.length === 0 || worstRatio([...values, item.value], side, scale) <= worstRatio(values, side, scale)) {
      row.push(item);
    } else {
      layoutRow(row, false);
      row = [item];
    }
  }
  if (row.length > 0) layoutRow(row, true);

  return cells;
}
