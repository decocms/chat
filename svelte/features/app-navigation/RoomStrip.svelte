<script lang="ts">
  import type { Snippet } from "svelte";
  import Tabs from "../../lib/studio/Tabs.svelte";
  import TabsList from "../../lib/studio/TabsList.svelte";
  import TabsTrigger from "../../lib/studio/TabsTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { roomsOnly, switcherDms, unread } from "../home/model";
  import type { AppNavigationSession } from "./controller";
  import RoomList from "./RoomList.svelte";
  /**
   * The top of the phone's thread sheet: This room | All rooms. This room is
   * the sidebar's own content (`children`, also what desktop shows); All rooms
   * is the room list, where a tap opens the room. Phones only.
   */
  let {
    controller,
    lang,
    children,
  }: {
    controller: AppNavigationSession;
    lang: HomeLanguage;
    children: Snippet;
  } = $props();
  const personal = $derived(controller.personal.state),
    nav = $derived(controller.state);
  let scope = $state<"room" | "all">("room");
  // Rooms with something new, the open one left out: the All rooms tab's dot.
  const fresh = $derived(
    ($personal.me?.books ?? []).filter(
      (room) =>
        room.id !== $nav.roomId && unread(room, $personal.seen[room.id] ?? 0),
    ).length,
  );
  const talkedDms = $derived(switcherDms($personal.me));
  const thisRoom = $derived(homeText(lang, "thisRoom")),
    allRooms = $derived(homeText(lang, "allRooms"));
</script>

<Tabs
  value={scope}
  onValueChange={(value) => (scope = value === "all" ? "all" : "room")}
  data-view="room-strip"
  class="shrink-0 gap-0 font-sans md:hidden"
>
  <TabsList
    variant="underline"
    aria-label={homeText(lang, "switchRoom")}
    class="h-10 w-full"
  >
    <TabsTrigger value="room" data-room-scope="room" class="flex-1"
      >{thisRoom}</TabsTrigger
    >
    <TabsTrigger value="all" data-room-scope="all" class="flex-1"
      >{allRooms}{#if fresh}<span
          role="img"
          aria-label={homeText(lang, "unreadRooms", { n: fresh })}
          class="size-1.5 rounded-full bg-destructive"
        ></span>{/if}</TabsTrigger
    >
  </TabsList>
</Tabs>
{#if scope === "all" && $personal.me}<div
    data-room-scope-panel="all"
    class="flex min-h-0 flex-1 flex-col md:hidden"
  >
    <RoomList
      rooms={roomsOnly($personal.me.books)}
      dms={talkedDms}
      waits={$personal.me.waits}
      seen={$personal.seen}
      now={$personal.now}
      current={$nav.roomId ?? null}
      {lang}
      onhome={controller.callbacks.home}
      onnavigate={controller.callbacks.navigate}
    />
  </div>{/if}
<div
  data-room-scope-panel="room"
  class={cn("contents", scope === "all" && "max-md:hidden")}
>
  {@render children()}
</div>
