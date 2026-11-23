<script module lang="ts">
  import {
    Accessibility,
    DragDropManager,
    PointerActivationConstraints,
    PointerSensor,
    defaultPreset,
  } from "@dnd-kit/dom";

  export const ROOT_GROUP = "root";
  export type SortMove = {
    id: string;
    group: string;
    fromIndex: number;
    toIndex: number;
  };

  // A mouse sorts after it moves 6 px; a finger holds 250 ms, so a swipe still scrolls. The row can be a
  // button or a link: a press and move on it must still sort.
  const sensors = [
    PointerSensor.configure({
      preventActivation: () => false,
      activationConstraints: (event) =>
        event.pointerType === "mouse"
          ? [new PointerActivationConstraints.Distance({ value: 6 })]
          : [
              new PointerActivationConstraints.Delay({
                value: 250,
                tolerance: 8,
              }),
            ],
    }),
  ];
  // Keyboard sorting is the list's own (Alt+Arrow), so Enter and Space keep opening the row.
  const plugins = defaultPreset.plugins.filter(
    (plugin) => plugin !== Accessibility,
  );
</script>

<script lang="ts">
  import { onDestroy, type Snippet } from "svelte";
  import { DragDropProvider } from "@dnd-kit/svelte";
  import { isSortable } from "@dnd-kit/svelte/sortable";

  /**
   * Drag to sort (@dnd-kit/svelte). `order` is the order while a row is dragged (null otherwise): the
   * parent shows it, so the others make room. On drop it goes back to null and `onmove` gets the move.
   */
  let {
    ids,
    order = $bindable(null),
    onmove,
    children,
  }: {
    ids: readonly string[];
    order?: string[] | null;
    onmove: (move: SortMove) => void;
    children: Snippet;
  } = $props();
  // Made here with the sensors and plugins, so rows register with them (the provider sets its props only
  // after the rows have registered).
  const manager = new DragDropManager({ sensors, plugins });
  onDestroy(() => manager.destroy());
</script>

<DragDropProvider
  {manager}
  {sensors}
  {plugins}
  onDragOver={(event) => {
    // The dragged row takes the place of the row under it. Indices here are in `ids`, the whole list; a
    // row's sortable index counts only its group, so dnd-kit's move() helper does not fit.
    const { source, target } = event.operation;
    if (!source || !target || source.id === target.id) return;
    const next = [...(order ?? ids)],
      from = next.indexOf(String(source.id)),
      to = next.indexOf(String(target.id));
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, String(source.id));
    order = next;
  }}
  onDragEnd={(event) => {
    order = null;
    const source = event.operation.source;
    if (event.canceled || !isSortable(source)) return;
    if (source.initialIndex === source.index) return;
    onmove({
      id: String(source.id),
      group: String(source.group),
      fromIndex: source.initialIndex,
      toIndex: source.index,
    });
  }}
>
  {@render children()}
</DragDropProvider>
