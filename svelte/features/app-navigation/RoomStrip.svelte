<script lang="ts">
  import type { Snippet } from "svelte";
  import Tabs from "../../lib/studio/Tabs.svelte";
  import TabsList from "../../lib/studio/TabsList.svelte";
  import TabsTrigger from "../../lib/studio/TabsTrigger.svelte";
  import { cn } from "../../lib/studio/utils";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { unread } from "../home/model";
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
  const thisRoom = $derived(homeText(lang, "thisRoom")),
    allRooms = $derived(homeText(lang, "allRooms"));
</script>

<Tabs
  value={scope}
  onValueChange={(value) => (scope = value === "all" ? "all" : "room")}
  data-vb-native="room-strip"
  class="tw:shrink-0 tw:gap-0 tw:font-sans tw:min-[901px]:hidden"
>
  <TabsList
    variant="underline"
    aria-label={homeText(lang, "switchRoom")}
    class="tw:h-10 tw:w-full"
  >
    <TabsTrigger value="room" data-room-scope="room" class="tw:flex-1"
      >{thisRoom}</TabsTrigger
    >
    <TabsTrigger value="all" data-room-scope="all" class="tw:flex-1"
      >{allRooms}{#if fresh}<span
          role="img"
          aria-label={homeText(lang, "unreadRooms", { n: fresh })}
          class="tw:size-1.5 tw:rounded-full tw:bg-brand"
        ></span>{/if}</TabsTrigger
    >
  </TabsList>
</Tabs>
{#if scope === "all" && $personal.me}<div
    data-room-scope-panel="all"
    class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:min-[901px]:hidden"
  >
    <RoomList
      rooms={$personal.me.books}
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
  class={cn("tw:contents", scope === "all" && "tw:max-[900px]:hidden")}
>
  {@render children()}
</div>
