// Pure list-reorder helper shared by crew and passenger ordering logic.

/** Return a new array with the item at `fromIndex` moved to `toIndex`. */
export function reorderIdList(
  ids: readonly string[],
  fromIndex: number,
  toIndex: number,
): string[] {
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
