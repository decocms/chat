<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import { ArrowUp, StopSquare } from "./icons";
  import { cn } from "./utils";

  /** Sends the message, or stops the agent while it streams. With children it is a labelled button. */
  let {
    label,
    state = "ready",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<
    ComponentProps<typeof Button>,
    "size" | "variant" | "disabled" | "href" | "target" | "rel" | "download"
  > & {
    /** Accessible name, translated by the caller: "Send", or "Stop" while streaming. */
    label: string;
    /** `idle` with nothing to send, `ready` to send, `streaming` to stop. */
    state?: "idle" | "ready" | "streaming";
  } = $props();
</script>

<Button
  bind:ref
  data-slot="composer-send"
  data-state={state}
  size={children ? "default" : "icon"}
  aria-label={children ? undefined : label}
  disabled={state === "idle"}
  {...rest}
  class={cn(
    "tw:disabled:bg-muted tw:disabled:text-subtle-foreground tw:shrink-0 tw:disabled:opacity-100 tw:[&_svg]:text-current!",
    className,
  )}
>
  {@render children?.()}
  {#if state === "streaming"}
    <Icon icon={StopSquare} class="tw:fill-current" />
  {:else}
    <Icon icon={ArrowUp} />
  {/if}
</Button>
