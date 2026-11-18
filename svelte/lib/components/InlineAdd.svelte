<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import Icon from "../studio/Icon.svelte";
  import IconButton from "../studio/IconButton.svelte";
  import { Check, User01, X } from "../studio/icons";

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
  class="tw:flex tw:h-9 tw:items-center tw:gap-2 tw:rounded-lg tw:bg-sidebar-accent tw:pr-1 tw:pl-2"
>
  <span
    class="tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-muted tw:text-muted-foreground"
    ><Icon icon={User01} size={12} /></span
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
    class="tw:m-0 tw:h-9 tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:font-sans tw:text-sm tw:pointer-coarse:text-[16px] tw:leading-5 tw:text-sidebar-foreground tw:shadow-none tw:outline-none tw:placeholder:text-muted-foreground"
  />
  <IconButton
    type="submit"
    variant="ghost"
    size="icon-xs"
    disabled={confirmDisabled}
    label={confirmLabel}><Icon icon={Check} /></IconButton
  >
  <IconButton
    variant="ghost"
    size="icon-xs"
    label={cancelLabel}
    onclick={oncancel}><Icon icon={X} /></IconButton
  >
</div>
