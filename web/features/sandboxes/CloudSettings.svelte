<script lang="ts">
  import { untrack } from "svelte";
  import SandboxPanel from "./SandboxPanel.svelte";
  import TerminalDialog from "./TerminalDialog.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Select from "../../lib/studio/Select.svelte";
  import SelectContent from "../../lib/studio/SelectContent.svelte";
  import SelectItem from "../../lib/studio/SelectItem.svelte";
  import SelectTrigger from "../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../lib/studio/SelectValue.svelte";
  import type { AgentsService } from "../agents/service";
  import { sandboxText, type SandboxLocale } from "./copy";
  /**
   * Settings › Cloud agents: your freestyle key, your Claude token and the
   * sandboxes of one of your rooms (each sandbox listens to one room). The room
   * starts as the one you came from (`/settings?room=<id>#cloud`), else the one
   * you opened last.
   */
  let {
    agents,
    account,
    rooms,
    room,
    lang,
  }: {
    agents: AgentsService;
    account: string;
    rooms: readonly { id: string; title: string }[];
    room: string | null;
    lang: SandboxLocale;
  } = $props();
  const text = (key: Parameters<typeof sandboxText>[1]) =>
    sandboxText(lang, key);
  let picked = $state<string | null>(null);
  // The room on screen stays while it is in the list. "The one you opened last" is only the first choice: the
  // list is sorted again at each /api/me refresh (opening a room in another tab), and following that order
  // changed the room, and so the whole panel, while the person used it.
  let shown: string | null = null;
  const roomId = $derived.by(() => {
    const id =
      [picked, room, shown, rooms[0]?.id].find(
        (id) => id && rooms.some((r) => r.id === id),
      ) ?? null;
    shown = id;
    return id;
  });
  // The scope depends on the account and room values only. A parent passes `account` as a getter that reads its
  // whole account store (`$view.binding.account`), so the effect read the store: each update of it (a /api/me
  // refresh) made a new scope and drew the panel again while the person used it.
  const email = $derived(account);
  let scope = $state.raw<ReturnType<AgentsService["cloud"]>>(null);
  $effect(() => {
    const who = email,
      id = roomId;
    const next = id ? untrack(() => agents.cloud(who, id)) : null;
    scope = next;
    return () => next?.dispose();
  });
</script>

<div class="flex flex-col gap-4">
  <!-- Always shown, even with one room: it names the room these sandboxes listen to. -->
  {#if rooms.length}<div class="flex flex-col gap-1">
      <Label for="cloud-room">{text("room")}</Label>
      <Select
        items={rooms.map((r) => ({ value: r.id, label: r.title }))}
        bind:value={() => roomId ?? "", (value) => (picked = value)}
      >
        <SelectTrigger id="cloud-room" data-cloud-room class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent class="font-sans">
          {#each rooms as r (r.id)}<SelectItem value={r.id} label={r.title}
              >{r.title}</SelectItem
            >{/each}
        </SelectContent>
      </Select>
    </div>{/if}
  {#if scope}{#key scope}<SandboxPanel
        owner={scope.sandboxes}
        credentials={scope.credentials}
        terminal={scope.terminal}
        {lang}
      /><TerminalDialog
        owner={scope.terminal}
        {lang}
      />{/key}{:else if !rooms.length}<p class="m-0 text-muted-foreground">
      {text("noRooms")}
    </p>{/if}
</div>
