<script module lang="ts">
  import {
    Accessibility,
    DragDropManager,
    PointerActivationConstraints,
    PointerSensor,
    defaultPreset,
  } from "@dnd-kit/dom";
  import { current, relift } from "./sortOrder";

  export const ROOT_GROUP = "root";
  export type SortMove = {
    id: string;
    group: string;
    /** All of `ids`, in the new order. */
    order: string[];
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
  import { onDestroy, tick, type Snippet } from "svelte";
  import { DragDropProvider } from "@dnd-kit/svelte";
  import { isSortable } from "@dnd-kit/svelte/sortable";

  /**
   * Drag to sort (@dnd-kit/svelte). `order` is the order while a row is dragged (null otherwise): the
   * parent shows it, so the others make room. On drop it goes back to null and `onmove` gets the move.
   * The move names rows by id: indices change when the list changes mid-drag.
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
  // Made here with the sensors and plugins, so rows register with them (the provider applies its props only
  // after the rows have registered). The props below are needed too: without them, the provider's effect
  // puts dnd-kit's defaults back (keyboard sensor, Accessibility plugin).
  const manager = new DragDropManager({ sensors, plugins });
  onDestroy(() => manager.destroy());
</script>

<DragDropProvider
  {manager}
  {sensors}
  {plugins}
  onDragOver={(event) => {
    // The dragged row takes the place of the row under it, in `ids` (the whole list). A row's sortable
    // index counts only its group, so dnd-kit's move() helper does not fit.
    const { source, target } = event.operation;
    if (!source || !target || source.id === target.id) return;
    const next = current(order, ids),
      from = next.indexOf(String(source.id)),
      to = next.indexOf(String(target.id));
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, String(source.id));
    order = next;
    // The parent draws the new order, which can move the dragged row's node: show it above the page again.
    const lifted = source.element;
    void tick().then(() => relift(lifted));
  }}
  onDragEnd={(event) => {
    const final = order && current(order, ids);
    order = null;
    const source = event.operation.source;
    if (event.canceled || !final || !isSortable(source)) return;
    if (final.join("\0") === ids.join("\0")) return;
    onmove({
      id: String(source.id),
      group: String(source.group),
      order: final,
    });
  }}
>
  {@render children()}
</DragDropProvider>
