import type { Epic } from "../../../shared/room";
/** Keep a directly opened done epic in its original tree position. */
export const activeEpics = (epics: readonly Epic[], thread: string) =>
  epics.filter((epic) => !epic.done || epic.id === thread);

/** The sidebar's thread tabs, in their order. "open" was "Threads abertas", "done" was "Feitas". */
export const THREAD_VIEWS = ["mine", "open", "done"] as const;
export type ThreadView = (typeof THREAD_VIEWS)[number];
export const isThreadView = (value: unknown): value is ThreadView =>
  THREAD_VIEWS.some((view) => view === value);

/** Mine: the threads of a list (the Open tab's) whose owner is you. The server stores owners in lower case. */
export const mineEpics = (epics: readonly Epic[], me: string) => {
  const email = me.trim().toLowerCase();
  return epics.filter(
    (epic) => !!email && epic.owner?.trim().toLowerCase() === email,
  );
};

export type EpicForest = {
  roots: Epic[];
  byId: Map<string, Epic>;
  parents: Map<string, string | null>;
  children: Map<string, Epic[]>;
};

/** Normalize a filtered list without losing orphaned or cyclic records. */
export function epicForest(epics: readonly Epic[]): EpicForest {
  const byId = new Map<string, Epic>();
  for (const epic of epics) if (!byId.has(epic.id)) byId.set(epic.id, epic);
  const parents = new Map<string, string | null>();
  for (const epic of byId.values())
    parents.set(
      epic.id,
      epic.parent && epic.parent !== epic.id && byId.has(epic.parent)
        ? epic.parent
        : null,
    );
  // Iterative cycle detection also handles arbitrarily deep imported hierarchies.
  const settled = new Set<string>();
  for (const start of byId.keys()) {
    const path: string[] = [];
    const position = new Map<string, number>();
    let current: string | null = start;
    while (current && !settled.has(current)) {
      const cycle = position.get(current);
      if (cycle !== undefined) {
        for (const id of path.slice(cycle)) parents.set(id, null);
        break;
      }
      position.set(current, path.length);
      path.push(current);
      current = parents.get(current) ?? null;
    }
    for (const id of path) settled.add(id);
  }
  const roots: Epic[] = [];
  const children = new Map<string, Epic[]>();
  for (const epic of byId.values()) {
    const parent = parents.get(epic.id);
    if (!parent) roots.push(epic);
    else {
      const siblings = children.get(parent) ?? [];
      siblings.push(epic);
      children.set(parent, siblings);
    }
  }
  return { roots, byId, parents, children };
}

export function epicAncestors(forest: EpicForest, id: string) {
  const ancestors: string[] = [];
  let parent = forest.parents.get(id);
  while (parent) {
    ancestors.push(parent);
    parent = forest.parents.get(parent);
  }
  return ancestors;
}

export function visibleEpics(
  forest: EpicForest,
  closed: ReadonlySet<string>,
  busy: ReadonlySet<string> = new Set(),
  includeHidden = false,
) {
  const busyAncestors = new Set<string>();
  for (const id of busy) {
    let parent = forest.parents.get(id);
    while (parent && !busyAncestors.has(parent)) {
      busyAncestors.add(parent);
      parent = forest.parents.get(parent);
    }
  }
  const rows: {
    epic: Epic;
    depth: number;
    hidden: boolean;
    hasChildren: boolean;
    busyBelow: boolean;
  }[] = [];
  const stack = forest.roots
    .map((epic) => ({ epic, depth: 0, hidden: false }))
    .reverse();
  while (stack.length) {
    const row = stack.pop()!;
    const children = forest.children.get(row.epic.id) ?? [];
    rows.push({
      ...row,
      hasChildren: children.length > 0,
      busyBelow: busyAncestors.has(row.epic.id),
    });
    if (includeHidden || !closed.has(row.epic.id))
      for (let i = children.length - 1; i >= 0; i--)
        stack.push({
          epic: children[i],
          depth: row.depth + 1,
          hidden: row.hidden || closed.has(row.epic.id),
        });
  }
  return rows;
}

/** The Done tab: newest made first, as the other tabs (Gimenes #5603). */
export function doneEpics(epics: readonly Epic[]) {
  return byCreated(epics.filter((epic) => epic.done));
}

/** Newest made first; without `created` (an older server), the reverse of the server's order (oldest first). */
function byCreated(epics: readonly Epic[]) {
  return epics
    .map((epic, index) => ({ epic, index }))
    .sort(
      (a, b) =>
        (b.epic.created ?? 0) - (a.epic.created ?? 0) || b.index - a.index,
    )
    .map(({ epic }) => epic);
}

/** Order siblings only; epic.order cannot change an epic's parent. */
export function reorderEpics(
  epics: readonly Epic[],
  from: string,
  to: string,
  after: boolean,
): string[] | null {
  if (from === to) return null;
  if (new Set(epics.map((epic) => epic.id)).size !== epics.length) return null;
  const active = epics.filter((epic) => !epic.done);
  const forest = epicForest(active);
  if (
    !forest.byId.has(from) ||
    !forest.byId.has(to) ||
    forest.parents.get(from) !== forest.parents.get(to)
  )
    return null;
  const ids = epics.map((epic) => epic.id).filter((id) => id !== from);
  ids.splice(ids.indexOf(to) + (after ? 1 : 0), 0, from);
  return ids.every((id, index) => id === epics[index]?.id) ? null : ids;
}

/** How many unpinned epics the sidebar lists before "Ver mais". */
export const EPIC_PAGE = 10;

/**
 * The sidebar's order: pinned epics first (in the room's shared order, which
 * their drag sets), then the rest by when they were made, newest first. The
 * order never changes when you open a thread or a message arrives
 * (Gimenes #5603): Mine, Open and Done all keep it.
 */
export function sidebarEpics(epics: readonly Epic[]) {
  return [
    ...epics.filter((epic) => epic.pinned),
    ...byCreated(epics.filter((epic) => !epic.pinned)),
  ];
}
