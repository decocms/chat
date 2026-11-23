<script lang="ts">
  import type { Room } from "../../../shared/room";
  import type { SidebarBridge } from "../../app/sidebar";
  import { suggestionAt, threadTitle } from "../room-sidebar/model";
  import type { RoomMutations } from "../room-sidebar/session";
  import EpicActions from "../room-sidebar/EpicActions.svelte";
  import MutationStatus from "../room-sidebar/MutationStatus.svelte";
  import { dmPeer } from "../room-scope/model";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  /**
   * The desktop top bar's title: what fills the middle. The room's name is in
   * the sidebar's header, so the bar names only the view: "Sala principal"
   * (a DM: the other person), the open epic or suggestion, or a full view
   * (the board). An epic's status follows its title (EpicActions;
   * Gimenes #3975), and its menu pins the epic (the epic list has no menu).
   */
  let {
    room,
    thread,
    owner,
    vb,
    quietLabel = true,
  }: {
    room: Room;
    thread: string;
    owner: RoomMutations;
    vb: SidebarBridge;
    /** Show "Sala principal" in a room's main thread; the header leaves it out when its search stands there. */
    quietLabel?: boolean;
  } = $props();
  const t = $derived(vb.t);
  const peer = $derived(dmPeer(room));
  const epic = $derived(room.epics.find((item) => item.id === thread));
  const suggestion = $derived(suggestionAt(room, thread));
  // A DM's own conversation is the person; a room's main thread (or a thread
  // that is gone) is a quiet label, not a second copy of the room's name.
  const person = $derived(!epic && !suggestion ? peer : null);
  const title = $derived(
    person
      ? room.book.title
      : (threadTitle(room, thread) ?? t("Sala principal")),
  );
  const quiet = $derived(!epic && !suggestion && !person);
  // The face beside the title: the epic's owner, or the DM's person.
  const face = $derived((epic ? epic.owner : person) ?? undefined);
</script>

<div
  data-room-bar-title
  class="@container flex min-w-0 flex-1 items-center gap-1 font-sans text-sm text-foreground"
>
  {#if !quiet || quietLabel}<h2
      data-thread-title
      {title}
      class={[
        "m-0 flex min-w-0 items-center gap-2 pl-1 text-sm font-medium",
        quiet && "text-muted-foreground",
      ]}
    >
      {#if epic || person}<PersonAvatar
          email={face}
          version={face ? vb.avatarVersion(face) : undefined}
          class="size-6"
        />{/if}<span class="truncate">{title}</span>
    </h2>{/if}
  {#if suggestion}<span
      class="min-w-0 shrink-[2] truncate text-xs text-muted-foreground"
      >✦ {t("sugestão do @vibe")}</span
    >{/if}
  {#if epic}<EpicActions {epic} {owner} {t} />{/if}
  <MutationStatus {owner} {t} />
</div>
