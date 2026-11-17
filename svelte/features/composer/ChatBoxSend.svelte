<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import { cn } from "../../lib/studio/utils";

  /** The labelled send pill at the end of a ChatBox; `pending` shows a spinner. */
  let {
    pending = false,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<
    ComponentProps<typeof Button>,
    "variant" | "size" | "href" | "target" | "rel" | "download" | "type"
  > & {
    pending?: boolean;
  } = $props();
</script>

<Button
  bind:ref
  type="submit"
  data-composer-send
  aria-busy={pending || undefined}
  {...rest}
  class={cn("tw:rounded-full", className)}
  >{#if pending}<Spinner size="2xs" />{/if}{@render children?.()}</Button
>
