export const ROOT_GROUP = "root";
export type SortableRowOptions = {
  id: string;
  index: number;
  group: string;
  disabled: boolean;
};
export type SortableMove = {
  id: string;
  group: string;
  fromIndex: number;
  toIndex: number;
};
type Engine = ReturnType<
  typeof import("./sortable-engine").createSortableEngine
>;
type RowHandle = {
  update?(options: SortableRowOptions): void;
  destroy?(): void;
};

/**
 * Sortable epic rows. The drag engine (@dnd-kit/dom, ~35 KB gzip) is loaded
 * once the sidebar has had a moment to render, so it stays out of the entry
 * bundle; rows register with it as soon as it arrives. Until then (or if it
 * cannot load) rows simply do not sort.
 */
export function createSortableRows(onmove: (move: SortableMove) => void) {
  let engine: Engine | null = null;
  let loading = false;
  let stopped = false;
  const pending = new Set<() => void>();
  const load = () => {
    if (loading || stopped) return;
    loading = true;
    const start = () =>
      void import("./sortable-engine")
        .then((module) => {
          if (stopped) return;
          engine = module.createSortableEngine(onmove);
          for (const attach of pending) attach();
          pending.clear();
        })
        .catch(() => {});
    if (typeof requestIdleCallback === "function")
      requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 300);
  };
  return {
    row(node: HTMLElement, options: SortableRowOptions) {
      let current = options;
      let handle: RowHandle | null = null;
      let gone = false;
      const attach = () => {
        if (!engine || gone || handle) return;
        handle = engine.row(node, current);
      };
      if (engine) attach();
      else {
        pending.add(attach);
        load();
      }
      return {
        update(next: SortableRowOptions) {
          current = next;
          handle?.update?.(next);
        },
        destroy() {
          gone = true;
          pending.delete(attach);
          handle?.destroy?.();
        },
      };
    },
    destroy() {
      stopped = true;
      pending.clear();
      engine?.destroy();
      engine = null;
    },
  };
}
