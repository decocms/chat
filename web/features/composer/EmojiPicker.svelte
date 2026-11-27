<script lang="ts">
  // Every emoji, next to the 🙂 that opened it (Valls): a popover anchored to the button on a desktop (it flips and
  // shifts to stay on screen, so the composer's opens upward), a sheet from the bottom on a phone or a touch screen.
  // The caller renders its own button through `trigger`, spreading the props it gets.
  import { onDestroy, type Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import Drawer from "../../lib/studio/Drawer.svelte";
  import DrawerContent from "../../lib/studio/DrawerContent.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import EmojiGrid from "./EmojiGrid.svelte";
  type Side = "top" | "bottom" | "left" | "right";
  let {
    t,
    open = $bindable(false),
    onpick,
    trigger,
    onbeforeopen,
    side = "top",
    align = "end",
    keepFocusOnPick = false,
    ...data
  }: {
    t: (text: string) => string;
    open?: boolean;
    onpick: (value: string) => void;
    /** The 🙂 button: spread `props` on it (they open the picker and anchor the popover). */
    trigger?: Snippet<[Record<string, unknown>]>;
    /** Before opening from the button; `false` keeps it closed. */
    onbeforeopen?: () => boolean | void;
    side?: Side;
    align?: "start" | "center" | "end";
    /** The pick moves focus itself (into a text field): closing after a pick leaves it there, not on the button. */
    keepFocusOnPick?: boolean;
    [key: `data-${string}`]: string | undefined;
  } = $props();
  const narrow = new MediaQuery(MOBILE_QUERY),
    coarse = new MediaQuery("(pointer: coarse)");
  const sheet = $derived(narrow.current || coarse.current);
  let search = $state<HTMLInputElement | null>(null),
    grid = $state<HTMLDivElement | null>(null),
    // Opened from the keyboard (Enter/Space on the button): no enter animation.
    keyboard = $state(false);
  let active = true,
    picked = false;
  onDestroy(() => {
    active = false;
  });
  function choose(value: string) {
    if (!active || !open) return;
    picked = true;
    onpick(value);
    open = false;
  }
  /** The button's click: the caller may veto, then the popover's own toggle (or the sheet). */
  function withOpen(props: Record<string, unknown>) {
    const click = props.onclick as ((event: MouseEvent) => void) | undefined,
      key = props.onkeydown as ((event: KeyboardEvent) => void) | undefined;
    const allowed = () => open || onbeforeopen?.() !== false;
    return {
      ...props,
      onclick: (event: MouseEvent) => {
        if (!allowed()) return;
        keyboard = event.detail === 0;
        if (click) click(event);
        else open = !open;
      },
      onkeydown: (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (!key) return;
        if (!allowed()) {
          event.preventDefault();
          return;
        }
        keyboard = true;
        key(event);
      },
    };
  }
  function closeFocus(event: Event) {
    if (picked && keepFocusOnPick) event.preventDefault();
    picked = false;
  }
  function focusSearch(event: Event) {
    const target = coarse.current
      ? grid?.querySelector("button") || null
      : search;
    if (target) {
      event.preventDefault();
      target.focus();
    }
  }
</script>

{#if sheet}{@render trigger?.(
    withOpen({ "aria-haspopup": "dialog", "aria-expanded": open }),
  )}
  <Drawer bind:open>
    <DrawerContent
      side="bottom"
      closeLabel={t("Fechar")}
      onOpenAutoFocus={focusSearch}
      onCloseAutoFocus={closeFocus}
      data-emoji-picker="sheet"
      {...data}
      class="gap-2 px-3 pb-3 font-sans text-sm text-foreground"
    >
      <SheetTitle class="sr-only">{t("Emoji")}</SheetTitle>
      <EmojiGrid {t} bind:search bind:grid onpick={choose} />
    </DrawerContent>
  </Drawer>{:else}<Popover bind:open>
    {#if trigger}<PopoverTrigger>
        {#snippet child({ props })}{@render trigger(withOpen(props))}{/snippet}
      </PopoverTrigger>{/if}
    <PopoverContent
      {side}
      {align}
      sideOffset={6}
      collisionPadding={8}
      aria-label={t("Emoji")}
      data-emoji-picker="popover"
      data-instant={keyboard || undefined}
      {...data}
      onOpenAutoFocus={focusSearch}
      onCloseAutoFocus={closeFocus}
      class="flex w-80 max-w-[calc(100vw-16px)] flex-col gap-2 p-3 font-sans text-sm text-foreground duration-150 ease-out data-instant:animate-none"
    >
      <EmojiGrid {t} bind:search bind:grid onpick={choose} />
    </PopoverContent>
  </Popover>{/if}
