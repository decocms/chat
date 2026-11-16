<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { File02, X } from "./icons";
  import { cn } from "./utils";

  /** One file or image waiting to be sent. */
  let {
    name,
    meta,
    src,
    onRemove,
    removeLabel,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    name: string;
    /** Size or type, e.g. "PDF · 2.4 MB". */
    meta?: string;
    /** An image preview; without it the attachment shows as a file. */
    src?: string;
    onRemove?: () => void;
    /** Accessible name of the remove button, translated by the caller. */
    removeLabel?: string;
    class?: string;
    ref?: HTMLDivElement | null;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="composer-attachment"
  {...rest}
  class={cn("tw:group/attachment tw:relative", className)}
>
  {#if src}
    <img
      {src}
      alt={name}
      class="tw:size-11 tw:rounded-[0.625rem] tw:object-cover tw:outline-1 tw:-outline-offset-1 tw:outline-hairline"
    />
  {:else}
    <div
      class="tw:bg-muted tw:flex tw:h-11 tw:max-w-56 tw:items-center tw:gap-2 tw:rounded-[0.625rem] tw:py-1.5 tw:pr-3 tw:pl-1.5"
    >
      <span
        class="tw:bg-card tw:text-muted-foreground tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:shadow-edge"
      >
        <Icon icon={File02} class="tw:size-4 tw:stroke-[1.33]" />
      </span>
      <span class="tw:flex tw:min-w-0 tw:flex-col">
        <span class="tw:truncate tw:text-xs tw:font-medium">{name}</span>
        {#if meta}
          <span
            class="tw:text-subtle-foreground tw:truncate tw:text-[0.6875rem]"
            >{meta}</span
          >
        {/if}
      </span>
    </div>
  {/if}
  {#if onRemove}
    <button
      type="button"
      onclick={onRemove}
      aria-label={removeLabel}
      class="tw:bg-foreground tw:text-background tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:absolute tw:-top-1.5 tw:-right-1.5 tw:flex tw:size-[1.125rem] tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:opacity-0 tw:transition-opacity tw:group-hover/attachment:opacity-100 tw:focus-visible:opacity-100 tw:disabled:cursor-not-allowed"
    >
      <Icon icon={X} class="tw:size-3" />
    </button>
  {/if}
</div>
