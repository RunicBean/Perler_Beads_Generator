export type GridBox = { left: number; top: number; right: number; bottom: number };
export function selectionBox(startX: number, startY: number, endX: number, endY: number, width: number, height: number): GridBox {
  const x = (n: number) => Math.max(0, Math.min(width - 1, Math.floor(n)));
  const y = (n: number) => Math.max(0, Math.min(height - 1, Math.floor(n)));
  return { left: Math.min(x(startX), x(endX)), top: Math.min(y(startY), y(endY)), right: Math.max(x(startX), x(endX)), bottom: Math.max(y(startY), y(endY)) };
}
export function selectBoxCells(cells: Array<string | null>, width: number, box: GridBox): number[] {
  const indices: number[] = [];
  for (let y = box.top; y <= box.bottom; y++) for (let x = box.left; x <= box.right; x++) {
    const index = y * width + x;
    if (cells[index]) indices.push(index);
  }
  return indices;
}
export function translateBox(box: GridBox, dx: number, dy: number): GridBox {
  return { left: box.left + dx, right: box.right + dx, top: box.top + dy, bottom: box.bottom + dy };
}

export function shiftCells(
  cells: Array<string | null>,
  width: number,
  height: number,
  dx: number,
  dy: number,
  selectionIndices?: number[],
): Array<string | null> {
  if (dx === 0 && dy === 0) return cells.slice();
  const moveIndices = selectionIndices ?? cells.flatMap((colorId, index) => (colorId ? [index] : []));
  const next = selectionIndices ? cells.slice() : Array<string | null>(width * height).fill(null);
  if (selectionIndices) {
    moveIndices.forEach((index) => {
      next[index] = null;
    });
  }
  moveIndices.forEach((index) => {
    const colorId = cells[index];
    if (!colorId) return;
    const x = index % width;
    const y = Math.floor(index / width);
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return;
    next[nextY * width + nextX] = colorId;
  });
  return next;
}

export function clampShiftDelta(
  cells: Array<string | null>,
  width: number,
  height: number,
  dx: number,
  dy: number,
  selectionIndices?: number[],
): { dx: number; dy: number } {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  const moveIndices = selectionIndices ?? cells.flatMap((colorId, index) => (colorId ? [index] : []));
  moveIndices.forEach((index) => {
    const colorId = cells[index];
    if (!colorId) return;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });
  if (maxX < 0 || maxY < 0) return { dx: 0, dy: 0 };
  return {
    dx: Math.min(width - 1 - maxX, Math.max(-minX, dx)),
    dy: Math.min(height - 1 - maxY, Math.max(-minY, dy)),
  };
}

export function canShiftSelection(
  cells: Array<string | null>,
  width: number,
  height: number,
  dx: number,
  dy: number,
  selectionIndices: number[],
): boolean {
  const selected = new Set(selectionIndices);
  return selectionIndices.every((index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const nextX = x + dx;
    const nextY = y + dy;
    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return false;
    const nextIndex = nextY * width + nextX;
    return selected.has(nextIndex) || !cells[nextIndex];
  });
}

