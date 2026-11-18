<script lang="ts">
  import type { HTMLOlAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { Check } from "./icons";
  import Stage from "./Stage.svelte";
  import { stageNumberVariants, stageStateAt } from "./stage-tracker";
  import { cn } from "./utils";

  /** Stages joined by hairline connectors. The line height is the one Studio pages inherit; the pills sit on that line. */
  let {
    stages,
    current,
    variant = "pill",
    onStageClick,
    visited,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLOlAttributes, "style" | "class" | "children"> & {
    /** Stage labels, in order. */
    stages: readonly string[];
    /** Index of the current stage; `stages.length` marks every stage done. */
    current: number;
    /** `pill` for a flow's status (Plan, Execute, Monitor); `numbered` for a wizard. */
    variant?: "pill" | "numbered";
    /** Makes done and visited stages clickable. */
    onStageClick?: (index: number) => void;
    /** Stages past `current` the user already reached and may jump back to. */
    visited?: ReadonlySet<number>;
    class?: string;
    ref?: HTMLOListElement | null;
  } = $props();
</script>

{#snippet content(label: string, index: number)}
  {@const state = stageStateAt(index, current)}
  {#if variant === "numbered"}
    <span class="flex items-center gap-2">
      <span class={stageNumberVariants({ state })}>
        {#if state === "done"}
          <Icon icon={Check} class="size-3.5" />
        {:else}
          {index + 1}
        {/if}
      </span>
      <span
        class={cn(
          "text-sm whitespace-nowrap",
          state === "upcoming"
            ? "text-muted-foreground"
            : "text-foreground font-medium",
        )}>{label}</span
      >
    </span>
  {:else}
    <Stage {state}>{label}</Stage>
  {/if}
{/snippet}

<ol
  bind:this={ref}
  data-slot="stage-tracker"
  data-variant={variant}
  {...rest}
  class={cn("flex items-center gap-2 leading-[1.5]", className)}
>
  {#each stages as label, index (label)}
    {@const clickable =
      onStageClick !== undefined &&
      index !== current &&
      (index < current || (visited?.has(index) ?? false))}
    <li class="flex items-center gap-2">
      {#if index > 0}
        <span
          aria-hidden="true"
          class={cn(
            "h-px",
            variant === "numbered" ? "mx-1 w-8" : "w-6",
            variant === "numbered" && index <= current
              ? "bg-foreground"
              : "bg-border",
          )}
        ></span>
      {/if}
      {#if clickable}
        <button
          type="button"
          onclick={() => onStageClick?.(index)}
          class="focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 cursor-pointer rounded-full transition-opacity hover:opacity-70 disabled:cursor-not-allowed"
        >
          {@render content(label, index)}
        </button>
      {:else}
        <span
          aria-current={variant === "numbered" &&
          stageStateAt(index, current) === "current"
            ? "step"
            : undefined}
        >
          {@render content(label, index)}
        </span>
      {/if}
    </li>
  {/each}
</ol>
