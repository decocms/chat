<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Tooltip from "../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../lib/studio/TooltipTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import { createApplicationCopy } from "../application/copy";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { roomIcon, type RoomSummary, type Wait } from "../home/model";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import CallBadge from "../rooms/CallBadge.svelte";
  import WaitBadge from "../waits/WaitBadge.svelte";
  import RailPill from "./RailPill.svelte";
  import { folderSignals, type RailFolder } from "./railFolders";
  import { roomMenuTrigger, type MenuPoint } from "./roomMenuTrigger";
  import { knownTint, tintText } from "./tints";
  /**
   * A folder on the rail (like Discord's server folders). Closed: one tile with
   * the first four rooms' icons in a 2×2 grid, the red number of what waits on
   * you in all of them, the edge dot when any has news, and the green
   * speaker when a call is on in any of them. Open: a header tile
   * (the folder icon, in the folder's color) and its rooms below it, on one
   * solid block. A click opens or closes it; a right-click opens its menu.
   */
  let {
    folder,
    rooms,
    open,
    lang,
    seen,
    waits,
    selected = false,
    target = false,
    ontoggle,
    onmenu,
    children,
  }: {
    folder: RailFolder;
    rooms: readonly RoomSummary[];
    open: boolean;
    lang: HomeLanguage;
    seen: Readonly<Record<string, number>>;
    waits: readonly Wait[];
    /** The open room is in this folder: a closed folder shows the current bar. */
    selected?: boolean;
    /** A dragged room is over it: let go to put it in. */
    target?: boolean;
    ontoggle: () => void;
    onmenu?: (trigger: HTMLElement, point?: MenuPoint) => void;
    /** The rooms, each a rail tile (AppNavigation sorts them). */
    children: Snippet;
  } = $props();
  const t = $derived(createApplicationCopy(lang));
  const name = $derived(folder.name || t("Pasta"));
  const signals = $derived(folderSignals(rooms, seen, waits));
  const mine = $derived(
    waits.filter((wait) => rooms.some((room) => room.id === wait.book_id)),
  );
  const pill = $derived(
    open ? "idle" : selected ? "selected" : (signals.unread ?? "idle"),
  );
  const call = $derived(
    signals.call.length
      ? homeText(lang, "inCall", { names: signals.call.join(", ") })
      : "",
  );
  const details = $derived(
    [
      t(rooms.length === 1 ? "{n} sala" : "{n} salas", { n: rooms.length }),
      call,
      signals.count
        ? homeText(lang, "waiting", { n: signals.count })
        : signals.unread
          ? homeText(lang, signals.unread === "human" ? "newHuman" : "newAgent")
          : "",
    ].filter(Boolean),
  );
</script>

<div
  data-rail-folder={folder.id}
  data-open={open || undefined}
  class={cn(
    "flex w-12 flex-col items-center rounded-2xl outline-offset-2 transition-colors duration-200 ease-out motion-reduce:transition-none",
    open ? "bg-sidebar-accent py-1.5" : "bg-transparent",
    target && "outline-2 outline-solid outline-foreground",
  )}
>
  <div
    data-rail-folder-head
    class="relative flex select-none"
    use:roomMenuTrigger={onmenu}
  >
    <Tooltip>
      <TooltipTrigger>
        {#snippet child({ props })}
          <button
            {...props}
            type="button"
            draggable="false"
            data-rail-folder-tile
            aria-expanded={open}
            aria-label={[name, ...details].join(" · ")}
            aria-keyshortcuts={onmenu ? "Shift+F10" : undefined}
            class={cn(
              "relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl border-0 p-0 outline-offset-2 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring motion-reduce:transition-none",
              open
                ? "bg-transparent hover:bg-sidebar"
                : "bg-sidebar-accent hover:bg-muted",
            )}
            onclick={(event) => {
              if (event.currentTarget.isConnected) ontoggle();
            }}
          >
            <RailPill state={pill} />
            {#if open}<Icon
                icon="folder"
                class={cn("size-5", tintText(knownTint(folder.tint)))}
              />{:else}<span
                data-rail-folder-icons
                class="grid grid-cols-2 grid-rows-2 gap-1 p-1"
                >{#each rooms.slice(0, 4) as room (room.id)}<RoomMark
                    title={room.title ?? "deco.chat"}
                    src={roomIcon(room)}
                    size="3xs"
                  />{/each}</span
              >{/if}
            {#if !open}<WaitBadge
                solid
                waits={mine}
                label={(n) => homeText(lang, "waiting", { n })}
                class={call
                  ? "absolute -right-1 bottom-0"
                  : "absolute -top-1.5 -right-1.5"}
              />{/if}
            {#if !open && call}<CallBadge label={call} corner="top" />{/if}
          </button>
        {/snippet}
      </TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={8}
        class="flex max-w-64 flex-col gap-0.5 py-1.5 text-left"
      >
        <span>{name}</span>
        <span class="font-normal opacity-60">{details.join(" · ")}</span>
      </TooltipContent>
    </Tooltip>
  </div>
  <!-- Opens and closes in under 250 ms (height and opacity, ease-out); reduced motion just shows or hides it. -->
  <div
    data-rail-folder-rooms
    inert={!open}
    class={cn(
      "grid w-full transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
    )}
  >
    <div
      role="list"
      aria-label={name}
      class={cn(
        "flex min-h-0 flex-col items-center",
        open ? "overflow-visible" : "overflow-hidden",
      )}
    >
      {@render children()}
    </div>
  </div>
</div>
