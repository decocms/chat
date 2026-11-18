<script lang="ts">
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
  const roomId = $derived(
    [picked, room, rooms[0]?.id].find(
      (id) => id && rooms.some((r) => r.id === id),
    ) ?? null,
  );
  let scope = $state.raw<ReturnType<AgentsService["cloud"]>>(null);
  $effect(() => {
    const next = roomId ? agents.cloud(account, roomId) : null;
    scope = next;
    return () => next?.dispose();
  });
</script>

<div class="tw:flex tw:flex-col tw:gap-4">
  <!-- Always shown, even with one room: it names the room these sandboxes listen to. -->
  {#if rooms.length}<div class="tw:flex tw:flex-col tw:gap-1">
      <Label for="cloud-room">{text("room")}</Label>
      <Select
        items={rooms.map((r) => ({ value: r.id, label: r.title }))}
        bind:value={() => roomId ?? "", (value) => (picked = value)}
      >
        <SelectTrigger id="cloud-room" data-cloud-room class="tw:w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent data-vb-native class="tw:font-sans">
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
      />{/key}{:else if !rooms.length}<p
      class="tw:m-0 tw:text-muted-foreground"
    >
      {text("noRooms")}
    </p>{/if}
</div>
