<script lang="ts">
  import type { Attachment, Room } from "../../../shared/room";
  import { fileURL } from "./model";
  import Icon from "../../lib/studio/Icon.svelte";
  import { File02 } from "../../lib/studio/icons";
  let {
    room,
    thread,
    lang = "pt",
    onopen,
  }: {
    room: Room;
    thread: string;
    lang?: "pt" | "en";
    onopen: (file: Attachment, trigger: HTMLElement) => void;
  } = $props();
  const files = $derived.by(() => {
    const names = new Map<string, Map<string, Attachment>>();
    if (thread === "main" || !room.epics.some((epic) => epic.id === thread))
      return [];
    for (const message of [...room.messages, ...(room.origins || [])])
      if (message.thread === thread)
        for (const file of message.files || []) {
          let versions = names.get(file.name);
          if (!versions) {
            versions = new Map();
            names.set(file.name, versions);
          }
          versions.set(file.id, file);
        }
    return [...names.values()]
      .map((versions) => {
        const list = [...versions.values()].sort((a, b) => b.ts - a.ts);
        return { file: list[0]!, count: list.length };
      })
      .sort((a, b) => b.file.ts - a.file.ts)
      .slice(0, 8);
  });
</script>

{#if files.length}<div
    data-vb-native
    data-thread-files
    class="flex items-center gap-2 overflow-x-auto p-2 font-sans text-sm text-foreground [scrollbar-width:none]"
  >
    <!-- One row that scrolls sideways: wrapped, 6 long names covered half a phone's chat (Gui #3402). -->
    <span class="flex shrink-0 items-center gap-1 text-muted-foreground"
      ><Icon icon={File02} size={16} />{lang === "en"
        ? "Files from this thread"
        : "Arquivos deste épico"}</span
    >{#each files as { file, count } (file.id)}<a
        href={fileURL({ roomId: room.id, id: file.id })}
        target="_blank"
        rel="noopener noreferrer"
        title={file.name}
        onclick={(event) => {
          if (
            !event.currentTarget.isConnected ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            event.button !== 0
          )
            return;
          event.preventDefault();
          onopen(file, event.currentTarget);
        }}
        class="inline-flex max-w-56 shrink-0 items-center gap-1 rounded-control border border-border bg-card px-2 py-1 text-foreground no-underline hover:bg-muted"
        ><Icon icon={File02} size={16} /><span class="truncate"
          >{file.name}</span
        >{#if count > 1}<span class="text-xs text-muted-foreground"
            >v{count}</span
          >{/if}</a
      >{/each}
  </div>{/if}
