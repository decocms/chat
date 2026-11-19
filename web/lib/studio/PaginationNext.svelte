<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Icon from "./Icon.svelte";
  import PaginationLink from "./PaginationLink.svelte";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<ComponentProps<typeof PaginationLink>, "children"> = $props();
</script>

<PaginationLink
  bind:ref
  aria-label="Go to next page"
  size="default"
  {...rest}
  class={cn("gap-1 px-2.5 md:pr-2.5", className)}
>
  <span class="hidden md:block">Next</span>
  <Icon icon="chevron-right" />
</PaginationLink>
