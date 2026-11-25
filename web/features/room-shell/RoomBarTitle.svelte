<script lang="ts">
  import { tick } from "svelte";
  import { CALL_THREAD } from "../../../shared/call";
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
      : thread === CALL_THREAD
        ? t("Chat da call")
        : (threadTitle(room, thread) ?? t("Sala principal")),
  );
  const quiet = $derived(!epic && !suggestion && !person);
  // The face beside the title: the epic's owner, or the DM's person.
  const face = $derived((epic ? epic.owner : person) ?? undefined);
  // Click the epic's name to rewrite it in place (Gimenes): Enter or a click away saves, Esc puts it back.
  // Any member of the room can rename an epic (Book "epic.rename"); others see plain text.
  const editable = $derived(!!epic && room.members.includes(room.me));
  let editing = $state(false),
    draft = $state(""),
    // What was just sent: shown until the room's state catches up, so the old name does not flash back.
    saving = $state<string | null>(null),
    input = $state<HTMLInputElement | null>(null);
  const shown = $derived(saving ?? title);
  async function startEdit() {
    if (!editable || editing) return;
    draft = title;
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }
  function cancelEdit() {
    editing = false;
  }
  function save() {
    if (!editing) return;
    editing = false;
    const next = draft.trim().slice(0, 200);
    if (!epic || !next || next === title) return;
    saving = next;
    void owner
      .run({ t: "epic.rename", id: epic.id, title: next })
      .finally(() => {
        saving = null;
      });
  }
  // Another thread opened while typing: drop the draft, it belonged to the other epic.
  $effect(() => {
    void thread;
    editing = false;
    saving = null;
  });
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
        />{/if}{#if editing}<span
          data-thread-title-sizer
          class="inline-grid min-w-0 [&>*]:col-start-1 [&>*]:row-start-1"
          ><span
            aria-hidden="true"
            class="invisible h-6 truncate px-1 text-sm leading-6 font-medium whitespace-pre"
            >{draft || " "}</span
          ><input
            bind:this={input}
            bind:value={draft}
            data-thread-title-input
            type="text"
            maxlength="200"
            aria-label={t("Nome da thread")}
            class="m-0 h-6 w-full min-w-16 rounded-md border-0 bg-muted px-1 leading-6 font-sans text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onblur={save}
            onkeydown={(event) => {
              if (event.isComposing) return;
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                cancelEdit();
              }
            }}
          /></span
        >{:else if editable}<button
          type="button"
          data-thread-title-edit
          aria-label={t("Renomear thread")}
          class="m-0 h-6 min-w-0 cursor-text truncate rounded-md border-0 bg-transparent px-1 text-left leading-6 font-sans text-sm font-medium text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          onclick={startEdit}>{shown}</button
        >{:else}<span class="truncate">{shown}</span>{/if}
    </h2>{/if}
  {#if suggestion}<span
      class="min-w-0 shrink-[2] truncate text-xs text-muted-foreground"
      >✦ {t("sugestão do @vibe")}</span
    >{/if}
  {#if epic}<EpicActions {epic} {owner} {t} />{/if}
  <MutationStatus {owner} {t} />
</div>
