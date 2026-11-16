<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Icon from "./Icon.svelte";
  import { ChevronRight } from "./icons";
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
  class={cn("tw:gap-1 tw:px-2.5 tw:sm:pr-2.5", className)}
>
  <span class="tw:hidden tw:sm:block">Next</span>
  <Icon icon={ChevronRight} />
</PaginationLink>
