<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { createSortable } from "@dnd-kit/svelte/sortable";
  import { ROOT_GROUP } from "./SortableList.svelte";

  /** One row of a SortableList. Rows sort only within their group. `id` stays the element's own. */
  let {
    sortId,
    index,
    group = ROOT_GROUP,
    disabled = false,
    as = "div",
    children,
    ...rest
  }: HTMLAttributes<HTMLElement> & {
    sortId: string;
    index: number;
    group?: string;
    disabled?: boolean;
    as?: "div" | "li";
    children: Snippet;
  } = $props();

  const kind = $derived(`sort:${group}`);
  const sortable = createSortable({
    get id() {
      return sortId;
    },
    get index() {
      return index;
    },
    get group() {
      return group;
    },
    get type() {
      return kind;
    },
    get accept() {
      return [kind];
    },
    get disabled() {
      return disabled;
    },
  });
</script>

<svelte:element this={as} {...rest} {@attach sortable.attach}
  >{@render children()}</svelte:element
>
