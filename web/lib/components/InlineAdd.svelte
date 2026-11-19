<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "../studio/Icon.svelte";
  import IconButton from "../studio/IconButton.svelte";

  /** A list row you type into: a blank face, the text, then confirm or cancel. Lives inside the caller's form. */
  let {
    value = $bindable(""),
    ref = $bindable(null),
    confirmLabel,
    cancelLabel,
    confirmDisabled = false,
    oncancel,
    ...rest
  }: Omit<HTMLInputAttributes, "style" | "class" | "value" | "children"> & {
    value?: string;
    ref?: HTMLInputElement | null;
    confirmLabel: string;
    cancelLabel: string;
    confirmDisabled?: boolean;
    oncancel: () => void;
  } = $props();
</script>

<div
  data-inline-add
  class="flex h-9 items-center gap-2 rounded-lg bg-sidebar-accent pr-1 pl-2"
>
  <span
    class="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
    ><Icon icon="user-01" size={12} /></span
  >
  <input
    bind:this={ref}
    bind:value
    {...rest}
    onkeydown={(event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      oncancel();
    }}
    class="m-0 h-9 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-sm pointer-coarse:text-[16px] leading-5 text-sidebar-foreground shadow-none outline-none placeholder:text-muted-foreground"
  />
  <IconButton
    type="submit"
    variant="ghost"
    size="icon-xs"
    disabled={confirmDisabled}
    label={confirmLabel}><Icon icon="check" /></IconButton
  >
  <IconButton
    variant="ghost"
    size="icon-xs"
    label={cancelLabel}
    onclick={oncancel}><Icon icon="x" /></IconButton
  >
</div>
