<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Icon from "./Icon.svelte";
  import { ChevronLeft } from "./icons";
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
  aria-label="Go to previous page"
  size="default"
  {...rest}
  class={cn("tw:gap-1 tw:px-2.5 tw:min-[901px]:pl-2.5", className)}
>
  <Icon icon={ChevronLeft} />
  <span class="tw:hidden tw:min-[901px]:block">Previous</span>
</PaginationLink>
