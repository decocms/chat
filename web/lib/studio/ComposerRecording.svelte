<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Button from "./Button.svelte";
  import { composerLevelHeight } from "./composer";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  /** Replaces the toolbar while recording: the live levels, cancel and confirm. */
  let {
    levels,
    cancelLabel,
    confirmLabel,
    onCancel,
    onConfirm,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    /** Recent input levels, each from 0 to 1, oldest first. */
    levels: readonly number[];
    cancelLabel: string;
    confirmLabel: string;
    onCancel?: () => void;
    onConfirm?: () => void;
    class?: string;
    ref?: HTMLDivElement | null;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="composer-recording"
  {...rest}
  class={cn("flex items-center gap-2 p-2 pl-4", className)}
>
  <span
    class="bg-destructive size-2 shrink-0 animate-pulse rounded-full motion-reduce:animate-none"
  ></span>
  <div aria-hidden="true" class="flex h-6 flex-1 items-center gap-[3px]">
    {#each levels as level, index (index)}
      <span
        class={cn(
          "bg-foreground/70 w-[3px] rounded-full transition-[height] duration-100",
          composerLevelHeight(level),
        )}
      ></span>
    {/each}
  </div>
  <Button
    variant="ghost"
    size="icon"
    aria-label={cancelLabel}
    onclick={onCancel}
  >
    <Icon icon="x" />
  </Button>
  <Button size="icon" aria-label={confirmLabel} onclick={onConfirm}>
    <Icon icon="check" />
  </Button>
</div>
