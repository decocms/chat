<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { CheckCircle } from "./icons";
  import { stageVariants, type StageState } from "./stage-tracker";
  import { cn } from "./utils";

  /** One step of a flow: done (checked), current (lime) or upcoming (quiet). */
  let {
    state,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLSpanElement>, "style" | "class" | "children"> & {
    state: StageState;
    class?: string;
    ref?: HTMLSpanElement | null;
    children?: Snippet;
  } = $props();
</script>

<span
  bind:this={ref}
  data-slot="stage"
  data-state={state}
  aria-current={state === "current" ? "step" : undefined}
  {...rest}
  class={cn(stageVariants({ state }), className)}
>
  {#if state === "done"}
    <Icon icon={CheckCircle} class="tw:size-3.5 tw:stroke-[1.5]" />
  {:else if state === "current"}
    <span
      aria-hidden="true"
      class="tw:flex tw:size-3.5 tw:items-center tw:justify-center"
    >
      <span class="tw:size-2 tw:rounded-full tw:bg-current"></span>
    </span>
  {:else}
    <span
      aria-hidden="true"
      class="tw:size-3.5 tw:rounded-full tw:border-[1.5px] tw:border-current"
    ></span>
  {/if}
  {@render children?.()}
</span>
