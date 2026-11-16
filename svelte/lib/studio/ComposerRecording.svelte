<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Button from "./Button.svelte";
  import { composerLevelHeight } from "./composer";
  import Icon from "./Icon.svelte";
  import { Check, X } from "./icons";
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
  class={cn("tw:flex tw:items-center tw:gap-2 tw:p-2 tw:pl-4", className)}
>
  <span
    class="tw:bg-destructive tw:size-2 tw:shrink-0 tw:animate-pulse tw:rounded-full tw:motion-reduce:animate-none"
  ></span>
  <div
    aria-hidden="true"
    class="tw:flex tw:h-6 tw:flex-1 tw:items-center tw:gap-[3px]"
  >
    {#each levels as level, index (index)}
      <span
        class={cn(
          "tw:bg-foreground/70 tw:w-[3px] tw:rounded-full tw:transition-[height] tw:duration-100",
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
    <Icon icon={X} />
  </Button>
  <Button size="icon" aria-label={confirmLabel} onclick={onConfirm}>
    <Icon icon={Check} />
  </Button>
</div>
