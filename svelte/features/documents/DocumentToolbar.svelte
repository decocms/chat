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
    bare = false,
    exclude,
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
    /** Inside the room's single top bar (desktop): no height, border or padding of its own. */
    bare?: boolean;
    /** Panes the host already offers elsewhere (the header's ✻ for agents). */
    exclude?: readonly DocumentPane[];
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
  // The top bar (bare): counts sit on the icon's top-right corner, like the
  // inbox's, instead of beside it. Only Reminders (and the board's lime "waiting on
  // you") keeps a count; how many files, apps or decisions there are is noise.
  const corner =
    "pointer-events-none absolute -top-1 -right-1 shadow-[0_0_0_2px_var(--vb-background)]";
  const short = (value: number | string) =>
    typeof value === "number" && value > 99 ? "99+" : value;
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
      : allItems.filter(
          (item) =>
            (!compact || item.id !== "board") && !exclude?.includes(item.id),
        ),
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
    "flex min-w-0 items-center gap-2 font-sans text-foreground",
    bare
      ? ""
      : compact
        ? "border-b border-border bg-background p-2"
        : "h-[52px] border-b border-border px-2",
  )}
>
  <div
    role={compact ? "toolbar" : "tablist"}
    aria-label={en ? "Room panels" : "Painéis da sala"}
    onkeydown={key}
    class={cn(
      "flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none]",
      // overflow-x clips vertically too: room for the corner badges (-top-1, -right-1).
      bare && "-my-1.5 py-1.5 pr-1.5",
    )}
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
                "relative shrink-0 gap-1.5 text-muted-foreground hover:text-foreground",
                labelled ? "px-2.5" : "px-2",
                selected && "bg-accent text-foreground",
                labelled && compact && "flex-1 justify-start",
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
                />{/if}{#if labelled}<span class="max-w-40 truncate"
                  >{item.label}</span
                >{/if}{#if item.id === "agents"}{:else if item.id === "board" && typeof count === "number" && count}<Count
                  value={count}
                  label={en
                    ? `Waiting on you: ${count}`
                    : `Esperando você: ${count}`}
                  class={bare ? corner : undefined}
                />{:else if count && (item.id === "reminders" || item.id === "doc")}<span
                  class={cn(
                    "min-w-[1.125rem] rounded-full bg-muted px-1 text-center text-xs leading-[1.125rem] text-muted-foreground tabular-nums",
                    // Same pill as the inbox's count; gray (lime is only for what waits on you).
                    bare &&
                      [
                        corner,
                        "h-[1.125rem] bg-muted-foreground font-medium leading-[1.125rem] text-background",
                      ].join(" "),
                  )}>{bare ? short(count) : count}</span
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
