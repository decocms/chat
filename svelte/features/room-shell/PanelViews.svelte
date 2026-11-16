<script lang="ts">
  import { tick } from "svelte";
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
  // The chat header's views card (T3's): the right panel's views in a card under the header's top-right corner.
  let {
    label,
    waitingLabel,
    en,
    pane,
    panelOpen,
    meta,
    onpick,
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
  } = $props();

  const cardId = $props.id();
  let open = $state(false),
    trigger = $state<HTMLElement | null>(null),
    card = $state<HTMLElement | null>(null);

  const rows = () => [
    ...(card?.querySelectorAll<HTMLButtonElement>("button[data-view]") ?? []),
  ];
  async function show() {
    open = true;
    await tick();
    const all = rows();
    (
      (panelOpen && all.find((row) => row.dataset.view === pane)) ||
      all[0]
    )?.focus();
  }
  function hide(returnFocus: boolean) {
    if (!open) return;
    open = false;
    if (returnFocus) trigger?.focus();
  }
  function pick(view: PanelView) {
    hide(true);
    onpick(view);
  }
  function onkeydown(event: KeyboardEvent) {
    const all = rows(),
      at = all.findIndex((row) => row === document.activeElement);
    const go = (index: number) => {
      event.preventDefault();
      all.at(index % all.length)?.focus();
    };
    if (event.key === "ArrowDown") go(at + 1);
    else if (event.key === "ArrowUp") go(at < 0 ? -1 : at - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(-1);
  }
  function onwindowkeydown(event: KeyboardEvent) {
    if (!open || event.key !== "Escape" || event.defaultPrevented) return;
    event.preventDefault();
    const active = document.activeElement;
    hide(active === trigger || !!card?.contains(active));
  }
  function onwindowpointerdown(event: PointerEvent) {
    const target = event.target;
    if (!open || !(target instanceof Node)) return;
    if (card?.contains(target) || trigger?.contains(target)) return;
    hide(false);
  }
  // Tabbing out of the card closes it, as leaving any popover does.
  function onfocusout(event: FocusEvent) {
    const next = event.relatedTarget;
    if (next instanceof Node && (card?.contains(next) || trigger === next))
      return;
    if (next) hide(false);
  }
</script>

<svelte:window
  onkeydown={onwindowkeydown}
  onpointerdown={onwindowpointerdown}
/>

<IconButton
  bind:ref={trigger}
  data-native-panel-views
  {label}
  tooltipSide="bottom"
  size="icon"
  aria-expanded={open}
  aria-controls={cardId}
  class="tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:aria-expanded:bg-accent tw:aria-expanded:text-foreground"
  onclick={() => (open ? hide(true) : void show())}
>
  <Icon icon={File06} size={16} />
</IconButton>
{#if open}
  <div
    bind:this={card}
    id={cardId}
    role="dialog"
    aria-label={label}
    tabindex="-1"
    data-vb-native
    {onkeydown}
    {onfocusout}
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
              onclick={() => pick(view)}
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
  </div>
{/if}
