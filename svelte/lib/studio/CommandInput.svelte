<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import { SearchMd } from "./icons";
  import { cn } from "./utils";

  /** `sm` is the input of a Command used as a MENU rather than a palette. `underline` is the palette's search row; `boxed` a standalone field above a separate list. */
  let {
    class: className,
    size = "default",
    variant = "underline",
    action,
    value = $bindable(""),
    onValueChange,
    oninput,
    ref = $bindable(null),
    ...rest
  }: Omit<CommandPrimitive.InputProps, "size" | "child" | "children"> & {
    /** Shadows the HTML `size` attribute, which a search input has no use for. */
    size?: "default" | "sm";
    variant?: "underline" | "boxed";
    /** Trailing control on the search row, e.g. a way out to a fuller picker. */
    action?: Snippet;
    onValueChange?: (search: string) => void;
  } = $props();

  const boxed = $derived(variant === "boxed");
  const height = $derived(size === "sm" ? "tw:h-9" : "tw:h-10");
</script>

<div
  data-slot="command-input-wrapper"
  data-variant={variant}
  class={cn(
    "tw:flex tw:items-center tw:gap-2 tw:px-3",
    height,
    boxed
      ? "tw:rounded-xl tw:border tw:border-input tw:bg-transparent tw:has-[:focus-visible]:outline-2 tw:has-[:focus-visible]:outline-solid tw:has-[:focus-visible]:outline-ring tw:has-[:focus-visible]:outline-offset-2"
      : "tw:border-border tw:border-b",
  )}
>
  <!-- The boxed field carries its own frame, so the magnifier would be a second thing saying "type here". -->
  {#if !boxed}
    <Icon
      icon={SearchMd}
      class="tw:size-4 tw:shrink-0 tw:text-muted-foreground"
    />
  {/if}
  <CommandPrimitive.Input
    bind:value
    bind:ref
    data-slot="command-input"
    class={cn(
      "tw:placeholder:text-muted-foreground tw:flex tw:w-full tw:rounded-md tw:bg-transparent tw:text-sm tw:outline-hidden tw:disabled:cursor-not-allowed tw:disabled:opacity-50",
      height,
      className,
    )}
    oninput={(event) => {
      oninput?.(event);
      onValueChange?.(event.currentTarget.value);
    }}
    {...rest}
  />
  {@render action?.()}
</div>
