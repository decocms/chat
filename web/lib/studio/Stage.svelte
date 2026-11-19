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
    <Icon icon={CheckCircle} class="size-3.5 stroke-[1.5]" />
  {:else if state === "current"}
    <span aria-hidden="true" class="flex size-3.5 items-center justify-center">
      <span class="size-2 rounded-full bg-current"></span>
    </span>
  {:else}
    <span
      aria-hidden="true"
      class="size-3.5 rounded-full border-[1.5px] border-current"
    ></span>
  {/if}
  {@render children?.()}
</span>
