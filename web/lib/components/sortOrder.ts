// Row order for SortableList (drag to sort). Rows are named by id: indices change when the list changes.

/** The drag order kept in line with `ids` when the list changes mid-drag: gone ids leave, new ones
 *  take their place in `ids`. */
export function current(order: string[] | null, ids: readonly string[]) {
  if (!order) return [...ids];
  const known = new Set(ids);
  const next = order.filter((id) => known.has(id));
  const placed = new Set(next);
  ids.forEach((id, index) => {
    if (!placed.has(id)) next.splice(index, 0, id);
  });
  return next;
}

/** Where `id` landed among `peers` (in `order`): before the next peer, or after the previous one. */
export function landing(
  order: readonly string[],
  id: string,
  peers: (id: string) => boolean,
): { to: string; after: boolean } | null {
  const group = order.filter((other) => other === id || peers(other));
  const at = group.indexOf(id);
  if (at < 0) return null;
  const next = group[at + 1],
    previous = group[at - 1];
  return next
    ? { to: next, after: false }
    : previous
      ? { to: previous, after: true }
      : null;
}
