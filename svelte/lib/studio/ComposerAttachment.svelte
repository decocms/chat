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
  class={cn("group/attachment relative", className)}
>
  {#if src}
    <img
      {src}
      alt={name}
      class="size-11 rounded-[0.625rem] object-cover outline-1 -outline-offset-1 outline-hairline"
    />
  {:else}
    <div
      class="bg-muted flex h-11 max-w-56 items-center gap-2 rounded-[0.625rem] py-1.5 pr-3 pl-1.5"
    >
      <span
        class="bg-card text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg shadow-edge"
      >
        <Icon icon={File02} class="size-4 stroke-[1.33]" />
      </span>
      <span class="flex min-w-0 flex-col">
        <span class="truncate text-xs font-medium">{name}</span>
        {#if meta}
          <span class="text-subtle-foreground truncate text-[0.6875rem]"
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
      class="bg-foreground text-background focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 absolute -top-1.5 -right-1.5 flex size-[1.125rem] cursor-pointer items-center justify-center rounded-full opacity-0 transition-opacity group-hover/attachment:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed"
    >
      <Icon icon={X} class="size-3" />
    </button>
  {/if}
</div>
