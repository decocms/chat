<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import Count from "../../lib/components/Count.svelte";
  import { paneIcons, paneLabel } from "./paneIcons";
  import AgentMark from "../agents/AgentMark.svelte";
  import type { AgentMarkView } from "../agents/model";
  import type { Room } from "../../../shared/room";
  import type { DocumentPane } from "./types";
  import type { DocumentSession } from "./session";
  let {
    owner,
    room,
    pane,
    lang,
    counts = {},
    agentTitle = "Agents",
    agent = { state: "off", count: 0, on: false },
    onPane,
    compact = false,
    sideFileName,
    only,
  }: {
    owner: DocumentSession;
    room: Room;
    pane: DocumentPane;
    lang: string;
    counts?: Partial<Record<DocumentPane, number | string>>;
    agentTitle?: string;
    /** The ✻ (`agentMark`): drawn in place of the Agents tab's icon. */
    agent?: AgentMarkView;
    onPane(pane: DocumentPane): void;
    compact?: boolean;
    sideFileName?: string;
    /** Only these panes (the phone's bottom-bar tab), in this order. */
    only?: readonly DocumentPane[];
  } = $props();
  const view = untrack(() => owner.state),
    en = $derived(lang === "en");
  let active = true;
  onDestroy(() => (active = false));
  const allItems: { id: DocumentPane; label: string }[] = $derived([
    ...(
      [
        "doc",
        "board",
        "files",
        "apps",
        "decisions",
        "reminders",
        "agents",
      ] as const
    ).map((id) => ({ id, label: paneLabel(id, en) })),
    ...(sideFileName
      ? [{ id: "view" as const, label: paneLabel("view", en) }]
      : []),
  ]);
  const epic = $derived(
    room.epics.find((epic) => epic.id === $view.target?.epicId),
  );
  const docCount = $derived(
    epic?.tasks.length
      ? `${epic.tasks.filter((task) => task.done).length}/${epic.tasks.length}`
      : "",
  );
  const docTitle = $derived(
    $view.text
      .match(/^#\s+(.+)$/m)?.[1]
      .replace(/[*_`]/g, "")
      .trim() ||
      epic?.title ||
      room.book.title,
  );
  const items = $derived(
    only
      ? only.flatMap((id) => allItems.filter((item) => item.id === id))
      : allItems.filter((item) => !compact || item.id !== "board"),
  );
  function choose(event: MouseEvent, id: DocumentPane) {
    event.stopPropagation();
    if (
      !active ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    )
      return;
    onPane(id);
  }
  function key(event: KeyboardEvent) {
    if (
      !active ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    )
      return;
    const buttons = [
        ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "button[data-document-pane]",
        ),
      ],
      at = buttons.findIndex((button) => button === document.activeElement);
    let next = at;
    if (event.key === "ArrowRight") next = (at + 1) % buttons.length;
    else if (event.key === "ArrowLeft")
      next = (at - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
    buttons[next]?.click();
  }
</script>

<div
  data-vb-native
  class={cn(
    "tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:font-sans tw:text-foreground",
    compact
      ? "tw:border-b tw:border-border tw:bg-background tw:p-2"
      : "tw:h-[52px] tw:border-b tw:border-border tw:px-2",
  )}
>
  <div
    role={compact ? "toolbar" : "tablist"}
    aria-label={en ? "Room panels" : "Painéis da sala"}
    onkeydown={key}
    class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:gap-0.5 tw:overflow-x-auto tw:[scrollbar-width:none]"
  >
    {#each items as item (item.id)}
      {@const selected = pane === item.id}
      {@const count =
        compact && item.id === "doc" && docCount ? docCount : counts[item.id]}
      {@const labelled = !!only || item.id === "doc" || item.id === "view"}
      <Tooltip disabled={labelled}>
        <TooltipTrigger>
          {#snippet child({ props })}<Button
              {...props}
              size="sm"
              variant="ghost"
              disabled={$view.denied && item.id !== "doc"}
              role={compact ? undefined : "tab"}
              aria-selected={compact ? undefined : selected}
              aria-pressed={compact ? selected : undefined}
              aria-label={labelled ? undefined : item.label}
              tabindex={compact || selected ? 0 : -1}
              data-document-pane={item.id}
              title={item.id === "doc"
                ? docTitle
                : item.id === "view"
                  ? item.label
                  : undefined}
              class={cn(
                "tw:relative tw:shrink-0 tw:gap-1.5 tw:text-muted-foreground tw:hover:text-foreground",
                labelled ? "tw:px-2.5" : "tw:px-2",
                selected && "tw:bg-accent tw:text-foreground",
                labelled && compact && "tw:flex-1 tw:justify-start",
              )}
              onclick={(event: MouseEvent) => choose(event, item.id)}
              >{#if item.id === "agents"}<AgentMark
                  state={agent.state}
                  count={agent.count}
                  on={agent.on}
                  size={17}
                />{:else}<Icon
                  icon={paneIcons[item.id]}
                  size={16}
                />{/if}{#if labelled}<span class="tw:max-w-40 tw:truncate"
                  >{item.label}</span
                >{/if}{#if item.id === "agents"}{:else if item.id === "board" && typeof count === "number" && count}<Count
                  value={count}
                  label={en
                    ? `Waiting on you: ${count}`
                    : `Esperando você: ${count}`}
                />{:else if count}<span
                  class="tw:min-w-[1.125rem] tw:rounded-full tw:bg-muted tw:px-1 tw:text-center tw:text-xs tw:leading-[1.125rem] tw:text-muted-foreground tw:tabular-nums"
                  >{count}</span
                >{/if}</Button
            >{/snippet}
        </TooltipTrigger>
        <TooltipContent side="bottom"
          >{item.id === "agents" ? agentTitle : item.label}</TooltipContent
        >
      </Tooltip>
    {/each}
  </div>
</div>
