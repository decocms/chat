<script lang="ts">
  import CommandDialog from "../../lib/studio/CommandDialog.svelte";
  import CommandEmpty from "../../lib/studio/CommandEmpty.svelte";
  import CommandGroup from "../../lib/studio/CommandGroup.svelte";
  import CommandInput from "../../lib/studio/CommandInput.svelte";
  import CommandItem from "../../lib/studio/CommandItem.svelte";
  import CommandList from "../../lib/studio/CommandList.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { ChatBridge, ChatMessage } from "../../app/chatTypes";
  import type { ForwardDestination } from "./destinations";
  import type { ForwardPort } from "./types";
  /**
   * "Encaminhar para…": the open room's threads, your rooms and your DMs, and (as you type) the threads of your other
   * rooms. A choice goes there and fills its composer (ForwardPort.send); nothing is sent.
   */
  let {
    open = $bindable(false),
    port,
    messages,
    ranged,
    vb,
    ondone,
  }: {
    open?: boolean;
    port: ForwardPort;
    messages: readonly ChatMessage[];
    ranged: boolean;
    vb: Pick<ChatBridge, "t" | "locale">;
    ondone: () => void;
  } = $props();
  const lang = $derived(vb.locale?.startsWith("en") ? "en" : "pt");
  let query = $state(""),
    threads = $state<readonly ForwardDestination[]>([]),
    searching = $state(false),
    busy = $state(""),
    error = $state("");
  const local = $derived(open ? port.destinations(query) : []);
  const groups = $derived(
    (
      [
        ["here", vb.t("Nesta sala")],
        ["rooms", vb.t("Salas")],
        ["dms", vb.t("Conversas")],
        ["threads", vb.t("Threads de outras salas")],
      ] as const
    )
      .map(([group, label]) => ({
        group,
        label,
        rows: (group === "threads" ? threads : local).filter(
          (row) => row.group === group,
        ),
      }))
      .filter(({ rows }) => rows.length),
  );
  // Threads of other rooms: the room search, from 2 characters, a moment after the last key.
  $effect(() => {
    const q = query.trim();
    threads = [];
    error = "";
    if (!open || q.length < 2) {
      searching = false;
      return;
    }
    searching = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      port.search(q, controller.signal).then(
        (found) => {
          if (controller.signal.aborted) return;
          threads = found;
          searching = false;
        },
        () => {
          if (!controller.signal.aborted) searching = false;
        },
      );
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });
  $effect(() => {
    if (open) return;
    query = "";
    busy = "";
    error = "";
  });
  async function choose(row: ForwardDestination) {
    if (busy) return;
    busy = row.key;
    error = "";
    const outcome = await port.send(row, messages, ranged);
    busy = "";
    if (outcome.ok) {
      open = false;
      ondone();
      return;
    }
    error =
      outcome.error === "file"
        ? vb.t("Não deu pra copiar o arquivo {name}. Tente de novo.", {
            name: outcome.name ?? "",
          })
        : vb.t("Não deu pra encaminhar. Tente de novo.");
  }
</script>

<CommandDialog
  bind:open
  shouldFilter={false}
  title={vb.t("Encaminhar para…")}
  description={vb.t("Escolha a sala, a conversa ou a thread.")}
  class="top-[12dvh] translate-y-0 font-sans md:max-w-[36rem]"
>
  <div data-forward-picker class="contents">
    <CommandInput
      bind:value={query}
      placeholder={vb.t("Encaminhar para…")}
      autocomplete="off"
      spellcheck="false"
    />
    <CommandList
      aria-label={vb.t("Encaminhar para…")}
      class="max-h-[min(60dvh,26rem)]"
    >
      {#if !searching}<CommandEmpty>{vb.t("Nada com esse nome.")}</CommandEmpty
        >{/if}
      {#each groups as { group, label, rows } (group)}<CommandGroup
          heading={label}
        >
          {#each rows as row (row.key)}<CommandItem
              size="lg"
              value={row.key}
              data-forward-target={row.key}
              disabled={!!busy && busy !== row.key}
              onSelect={() => void choose(row)}
            >
              {#if row.thread !== "main"}<!-- A thread: the icon the search (Cmd+K) gives one. -->
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                  ><Icon icon="target-04" class="size-4" /></span
                >{:else}<RoomAvatar
                  title={row.group === "here"
                    ? row.detail || row.title
                    : row.title}
                  icon={row.icon}
                  person={row.person}
                  {lang}
                  size="md"
                  surface="background"
                />{/if}
              <span class="flex min-w-0 flex-1 flex-col">
                <span class="truncate font-medium">{row.title}</span>
                {#if row.detail}<span
                    class="truncate text-xs text-muted-foreground"
                    >{row.detail}</span
                  >{/if}
              </span>
              {#if busy === row.key}<Spinner
                  class="size-4 text-muted-foreground"
                />{/if}
            </CommandItem>{/each}
        </CommandGroup>{/each}
      {#if searching}<p
          role="status"
          class="m-0 flex items-center justify-center gap-2 px-4 py-3 text-xs text-muted-foreground"
        >
          <Spinner class="size-3.5" />{vb.t("Buscando threads…")}
        </p>{/if}
    </CommandList>
    {#if error}<p
        role="alert"
        class="m-0 border-t border-border px-4 py-2.5 text-sm break-words text-destructive"
      >
        {error}
      </p>{/if}
  </div>
</CommandDialog>
