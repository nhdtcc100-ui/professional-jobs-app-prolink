/** Legal cuts are block tops; a heading can protect the following block's top. */
export function allowedBreaks(blocks: { top: number; bottom: number; keepWithNext?: boolean }[]): number[] {
  const positions = new Set<number>();
  const forbidden = new Set<number>();
  blocks.forEach((block, index) => {
    if (Number.isFinite(block.top) && block.top >= 0) positions.add(Math.floor(block.top));
    const next = blocks[index + 1];
    if (block.keepWithNext && next && Number.isFinite(next.top)) forbidden.add(Math.floor(next.top));
  });
  return [...positions].filter(position => !forbidden.has(position)).sort((a, b) => a - b);
}

/** Falls back to a forced cut when no legal boundary fits the current page. */
export function computePageSlices(
  total: number,
  breaks: number[],
  firstCapacity: number,
  nextCapacity: number,
): { start: number; height: number }[] {
  if (!Number.isFinite(total) || total < 0) throw new Error('Invalid pagination total');
  if (![firstCapacity, nextCapacity].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Page capacities must be finite and positive');
  }
  const legal = [...new Set(breaks.filter(value => Number.isFinite(value) && value > 0 && value < total))].sort((a, b) => a - b);
  const slices: { start: number; height: number }[] = [];
  let start = 0;
  let breakIndex = 0;
  while (start < total) {
    if (slices.length >= 40) throw new Error('CV pagination exceeds the 40-page limit');
    const capacity = slices.length === 0 ? firstCapacity : nextCapacity;
    let end = Math.min(total, start + capacity);
    // Snap only machine-precision remainders, avoiding an accidental 41st page.
    const tolerance = Number.EPSILON * Math.max(total, end) * 8;
    if (total - end <= tolerance) end = total;
    if (end <= start) throw new Error('Page capacity is too small to advance pagination');
    if (end < total) {
      let best = end;
      while (breakIndex < legal.length && legal[breakIndex] <= end) {
        if (legal[breakIndex] > start) best = legal[breakIndex];
        breakIndex++;
      }
      end = best;
    }
    slices.push({ start, height: end - start });
    start = end;
  }
  return slices;
}
