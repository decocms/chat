<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  /** Ported from @decocms/ui `Select`. `defaultValue` is the initial `value`; pass `items` so a closed select can show the label of its value. */
  let {
    value = $bindable(""),
    open = $bindable(false),
    ...rest
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    items?: { value: string; label: string; disabled?: boolean }[];
    disabled?: boolean;
    required?: boolean;
    name?: string;
    children?: Snippet;
  } = $props();
</script>

<SelectPrimitive.Root type="single" bind:value bind:open {...rest} />
