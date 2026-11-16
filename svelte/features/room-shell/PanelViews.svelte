<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Separator from "../../lib/studio/Separator.svelte";
  import { File06 } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import Count from "../../lib/components/Count.svelte";
  import { paneIcons, paneLabel } from "../documents/paneIcons";
  import {
    PANEL_VIEW_GROUPS,
    type PanelView,
    type PanelViewMeta,
  } from "./panelViews";
  // The chat header's views card (T3's): a toggle that keeps the right panel's views listed in the chat's corner while that panel is closed.
  let {
    label,
    waitingLabel,
    en,
    pane,
    panelOpen,
    meta,
    onpick,
    onclosepanel,
  }: {
    label: string;
    waitingLabel: (count: number) => string;
    en: boolean;
    /** The view the right panel shows. */
    pane: string;
    /** Whether the right panel is on screen. */
    panelOpen: boolean;
    meta: Partial<Record<PanelView, PanelViewMeta>>;
    /** Shows the view in the right panel, opening it when closed. */
    onpick: (view: PanelView) => void;
    /** Closes the right panel, so the card has the chat's corner to itself. */
    onclosepanel: () => void;
  } = $props();

  const STORAGE_KEY = "vb.panelViews.pinned";
  const cardId = $props.id();
  let pinned = $state(readPinned());
  let card = $state<HTMLElement | null>(null);
  const visible = $derived(pinned && !panelOpen);

  function readPinned(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }
  function setPinned(value: boolean) {
    pinned = value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    } catch {
      /* Private mode: the toggle still works for this page. */
    }
  }
  function toggle() {
    if (panelOpen) {
      setPinned(true);
      onclosepanel();
    } else setPinned(!pinned);
  }
  function onkeydown(event: KeyboardEvent) {
    const all = [
      ...(card?.querySelectorAll<HTMLButtonElement>("button[data-view]") ?? []),
    ];
    const at = all.findIndex((row) => row === document.activeElement);
    const go = (index: number) => {
      event.preventDefault();
      all.at(index % all.length)?.focus();
    };
    if (event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowUp") go(at < 0 ? -1 : at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(-1);
  }
</script>

<IconButton
  data-native-panel-views
  {label}
  tooltipSide="bottom"
  size="icon"
  aria-pressed={visible}
  aria-controls={cardId}
  class="tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:aria-pressed:bg-accent tw:aria-pressed:text-foreground"
  onclick={toggle}
>
  <Icon icon={File06} size={16} />
</IconButton>
{#if visible}
  <nav
    bind:this={card}
    id={cardId}
    aria-label={label}
    data-vb-native
    {onkeydown}
    class="tw:absolute tw:top-[calc(100%+8px)] tw:right-2 tw:z-40 tw:w-[288px] tw:origin-top-right tw:rounded-surface tw:bg-popover tw:p-2 tw:font-sans tw:text-sm tw:text-popover-foreground tw:shadow-edge-raised tw:outline-hidden tw:animate-in tw:duration-150 tw:ease-[var(--vb-ease-out-cubic)] tw:[--tw-enter-opacity:0] tw:[--tw-enter-scale:.96] tw:motion-reduce:animate-none"
  >
    {#each PANEL_VIEW_GROUPS as group, index (index)}
      {#if index}<Separator class="tw:-mx-2 tw:my-2 tw:w-auto!" />{/if}
      <ul class="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-0.5 tw:p-0">
        {#each group as view (view)}
          {@const selected = panelOpen && pane === view}
          {@const info = meta[view]}
          <li>
            <button
              type="button"
              data-view={view}
              aria-current={selected ? "true" : undefined}
              class={cn(
                "tw:flex tw:h-9 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-2.5 tw:text-left tw:text-foreground tw:transition-colors tw:duration-150 tw:ease-[var(--vb-ease-out-cubic)] tw:hover:bg-accent tw:focus-visible:bg-accent tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-ring",
                selected && "tw:bg-accent",
              )}
              onclick={() => onpick(view)}
            >
              <Icon
                icon={paneIcons[view]}
                size={16}
                class="tw:shrink-0 tw:text-muted-foreground"
              />
              <span class="tw:min-w-0 tw:flex-1 tw:truncate"
                >{paneLabel(view, en)}</span
              >
              {#if info?.kind === "waiting"}<Count
                  value={info.value}
                  label={waitingLabel(info.value)}
                />{:else if info}<span
                  class="tw:text-xs tw:text-muted-foreground tw:tabular-nums"
                  >{info.value}</span
                >{/if}
            </button>
          </li>
        {/each}
      </ul>
    {/each}
  </nav>
{/if}
