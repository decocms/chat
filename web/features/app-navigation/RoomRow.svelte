<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    NAV_ROW_TEXT,
    navRow,
    type NavRowVariant,
  } from "../../lib/components/navRow";
  /**
   * One place to go in a list: a room, a DM or Home. The caller draws what
   * stands for it (`leading`: an avatar, an icon) and anything at its end
   * (`trailing`: a count); `meta` is one status line under the label. A plain
   * click opens it in place (`onopen`); a modified click follows the link.
   * `children` sit under the row (the open DM's threads).
   */
  let {
    href,
    label,
    meta,
    urgent = false,
    selected = false,
    faded = false,
    variant = "sidebar",
    leading,
    trailing,
    children,
    onopen,
  }: {
    href: string;
    label: string;
    meta?: string;
    /** The status line asks something of you (a wait): drawn in the warning tone. */
    urgent?: boolean;
    selected?: boolean;
    /** Not started yet (a friend you haven't talked to). */
    faded?: boolean;
    variant?: NavRowVariant;
    leading: Snippet;
    trailing?: Snippet;
    children?: Snippet;
    onopen: () => void;
  } = $props();
</script>

<a
  {href}
  aria-current={selected ? (children ? "true" : "page") : undefined}
  class={navRow({ variant, faded })}
  onclick={(event) => {
    if (
      !event.currentTarget.isConnected ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    onopen();
  }}
  >{@render leading()}<span class="flex min-w-0 flex-1 flex-col"
    ><span class={NAV_ROW_TEXT[variant].label}>{label}</span>{#if meta}<span
        class={[
          NAV_ROW_TEXT[variant].meta,
          "font-normal",
          urgent ? "text-warning" : "text-muted-foreground",
        ]}>{meta}</span
      >{/if}</span
  >{@render trailing?.()}</a
>{@render children?.()}
