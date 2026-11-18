<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    avatarImageVariants,
    avatarVariants,
    FALLBACK_DELAY_MS,
    getColorFromString,
    getInitials,
    ICON_SIZES,
    MUTED_COLOR,
    type AvatarSize,
    type AvatarTone,
  } from "./avatar";
  import AvatarFallback from "./AvatarFallback.svelte";
  import AvatarImage from "./AvatarImage.svelte";
  import AvatarRoot from "./AvatarRoot.svelte";
  import Icon from "./Icon.svelte";
  import { User01 } from "./icons";
  import { cn } from "./utils";

  /** The image, or the name's initials on its colour; circle for people, square otherwise. */
  let {
    shape = "square",
    size = "base",
    url,
    fallback,
    objectFit = "cover",
    class: className,
    muted = false,
    tone,
    selected = false,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    /** Image URL, or `icon://…` for the generic person icon. */
    url?: string;
    /** A name, shown as its initials, or any snippet. Shown until the image loads. */
    fallback: string | Snippet;
    objectFit?: "contain" | "cover";
    /** Grey instead of the name's colour: a deleted user, an org in the rail. */
    muted?: boolean;
    /** `solid` fills the tile with the brand colour instead of its tint; circles default to it. */
    tone?: AvatarTone;
    /** An ink ring outside the tile: the current org in the rail. */
    selected?: boolean;
    shape?: "circle" | "square";
    size?: AvatarSize;
    class?: string;
    ref?: HTMLElement | null;
  } = $props();

  const color = $derived(
    muted
      ? MUTED_COLOR
      : getColorFromString(
          typeof fallback === "string" ? fallback : "",
          tone ?? (shape === "circle" ? "solid" : "tint"),
        ),
  );
  const tile = $derived(
    cn("tw:flex tw:size-full tw:items-center tw:justify-center", color),
  );

  // The fallback waits a beat for each image (a cached one lands without a flash of initials). The wait starts over
  // when the URL changes (a new picture version), so a tile drawn earlier behaves like one drawn now.
  let waited = $state(false);
  $effect(() => {
    waited = false;
    if (!url) return;
    const timer = setTimeout(() => {
      waited = true;
    }, FALLBACK_DELAY_MS);
    return () => clearTimeout(timer);
  });
  // Typed loosely on the way through: the primitive's prop union is too large for TypeScript to re-check after a spread.
  const passthrough = $derived<Record<string, unknown>>(rest);
</script>

<AvatarRoot
  bind:ref
  {...passthrough}
  class={cn(
    avatarVariants({ shape, size }),
    // A hairline keeps a white logo from dissolving into the page.
    url && "tw:outline-1 tw:-outline-offset-1 tw:outline-hairline",
    selected && "tw:outline-2 tw:outline-offset-0 tw:outline-foreground",
    className,
  )}
>
  {#if url?.startsWith("icon://")}
    <div class={tile}>
      <Icon icon={User01} size={ICON_SIZES[size]} />
    </div>
  {:else}
    {#if url}
      <AvatarImage
        src={url}
        loading="lazy"
        alt="Avatar"
        class={avatarImageVariants({ objectFit })}
      />
    {/if}
    {#if !url || waited}
      <AvatarFallback class={cn(tile, "tw:rounded-none")}>
        {#if typeof fallback === "string"}{getInitials(
            fallback,
          )}{:else}{@render fallback()}{/if}
      </AvatarFallback>
    {/if}
  {/if}
</AvatarRoot>
