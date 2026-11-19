<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements";
  import {
    listRowLeadVariants,
    listRowVariants,
    type ListRowVariants,
  } from "./list-row";
  import { cn } from "./utils";

  /** One thing in a list: lead, title over meta, and an optional trailing action. `asChild` became `href` for a link and the `child` snippet for any other element. */
  let {
    lead,
    title,
    meta,
    trailing,
    variant,
    interactive,
    selected,
    href,
    class: className,
    ref = $bindable(null),
    child,
    ...rest
  }: ListRowVariants &
    Omit<
      HTMLAttributes<HTMLElement>,
      "style" | "class" | "children" | "title"
    > &
    Pick<HTMLAnchorAttributes, "href" | "target" | "rel" | "download"> & {
      /** An icon, an avatar or a project tile. */
      lead?: Snippet;
      title: string | Snippet;
      meta?: string | Snippet;
      /** An action or a value at the end of the row. */
      trailing?: Snippet;
      /** The current item of a list, e.g. the open section. */
      selected?: boolean;
      class?: string;
      ref?: HTMLElement | null;
      /** Render as your own element: spread `props` on it and render `content` inside. */
      child?: Snippet<[{ props: Record<string, unknown>; content: Snippet }]>;
    } = $props();

  const isLink = $derived(href !== undefined && href !== null);
  const attributes = $derived({
    "data-slot": "list-row",
    "aria-current": selected || undefined,
    ...rest,
    class: cn(
      listRowVariants({
        variant,
        interactive: interactive ?? (Boolean(child) || isLink),
      }),
      className,
    ),
  });
</script>

{#snippet content()}
  {#if lead}
    <span class={listRowLeadVariants({ variant })}>{@render lead()}</span>
  {/if}
  <div class="flex min-w-0 flex-1 flex-col gap-0.5">
    <span class={cn("truncate text-sm", variant === "divided" && "font-medium")}
      >{#if typeof title === "string"}{title}{:else}{@render title()}{/if}</span
    >
    {#if meta}
      <span
        class={cn(
          "truncate text-xs",
          variant === "divided"
            ? "text-muted-foreground"
            : "text-subtle-foreground",
        )}
        >{#if typeof meta === "string"}{meta}{:else}{@render meta()}{/if}</span
      >
    {/if}
  </div>
  {@render trailing?.()}
{/snippet}

{#if child}
  {@render child({ props: attributes, content })}
{:else if isLink}
  <a bind:this={ref} {href} {...attributes}>{@render content()}</a>
{:else}
  <div bind:this={ref} {...attributes}>{@render content()}</div>
{/if}
