<script lang="ts">
  // Doc versions (Gui #2666): pick a version of the doc on screen; an old one is shown read-only above the live doc
  // with Restaurar (writes it back as the live doc, itself a new version) and "Ver na conversa" (the chat at that
  // moment: the newest message of the doc's thread up to the version's msg_id).
  import { untrack } from "svelte";
  import type { DocumentProps } from "./types";
  import Button from "../../lib/studio/Button.svelte";
  import DocumentPreview from "./DocumentPreview.svelte";
  import Select from "../../lib/studio/Select.svelte";
  import SelectContent from "../../lib/studio/SelectContent.svelte";
  import SelectItem from "../../lib/studio/SelectItem.svelte";
  import SelectTrigger from "../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../lib/studio/SelectValue.svelte";
  import type { DocumentSession } from "./session";
  import { docVersionList, docVersionOpen } from "./versions";
  let {
    owner,
    props,
    epic,
    part,
  }: {
    owner: DocumentSession;
    props: DocumentProps;
    epic: string | null;
    /** "picker" = the small select in the pane's header row; "open" = the old version's view
     *  (and the one instance that asks for the list). */
    part: "picker" | "open";
  } = $props();
  const en = $derived(props.lang === "en");
  const key = $derived(epic ?? "");
  // Only when the doc on screen changes: props change on every room event, and reading them here cleared the open
  // version as soon as it arrived.
  $effect(() => {
    const doc = key;
    if (part !== "open") return;
    untrack(() => {
      docVersionOpen.set(null);
      props.send({ t: "doc.versions", epic: doc || null });
    });
  });
  const list = $derived(
    $docVersionList?.epic === key ? $docVersionList.versions : [],
  );
  const open = $derived($docVersionOpen?.epic === key ? $docVersionOpen : null);
  const who = (by: string[]) =>
    by
      .map((w) =>
        w === "agent"
          ? "Claude"
          : w === "yjs"
            ? en
              ? "live editor"
              : "editor ao vivo"
            : w === "tasks"
              ? en
                ? "tasks"
                : "tarefas"
              : (props.room.names?.[w] ?? w.split("@")[0]),
      )
      .join(", ");
  const when = (ts: number) =>
    new Date(ts).toLocaleString(en ? "en-US" : "pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const number = $derived(
    open ? list.length - list.findIndex((v) => v.id === open.id) : 0,
  );
  const LIVE = "live";
  let trigger = $state<HTMLElement | null>(null);
  const label = $derived(props.taskProps.vb.t("Versões do doc"));
  const versions = $derived([
    { value: LIVE, label: props.taskProps.vb.t("Atual (ao vivo)") },
    ...list.map((v, i) => ({
      value: String(v.id),
      label: `v${list.length - i} · ${when(v.ts)} · ${who(v.by)}`,
    })),
  ]);
  function pick(value: string) {
    if (value === LIVE) docVersionOpen.set(null);
    else props.send({ t: "doc.version", id: Number(value) });
  }
  function restore() {
    if (!open) return;
    const ok = confirm(
      en
        ? "Restore this version? The current doc becomes a version too, nothing is lost."
        : "Restaurar esta versão? O doc atual vira uma versão também, nada se perde.",
    );
    if (!ok) return;
    props.send({ t: "doc", text: open.text, epic });
    docVersionOpen.set(null);
  }
  function chat() {
    if (!open) return;
    const thread = open.epic || "main",
      at = props.room.messages
        .filter((m) => m.thread === thread && m.id <= open.msg_id)
        .pop();
    props.actions.navigate(at ? at.id : open.msg_id, thread);
  }
</script>

{#if part === "picker" && list.length}<label
    data-doc-versions
    class="flex max-w-[55%] min-w-0 shrink items-center text-sm"
    ><span class="sr-only">{label}</span>
    <Select
      items={versions}
      bind:value={
        () => (open ? String(open.id) : LIVE),
        (value) => {
          if (trigger?.isConnected) pick(value);
        }
      }
      onOpenChange={(opened) => {
        if (opened) props.send({ t: "doc.versions", epic });
      }}
    >
      <SelectTrigger
        bind:ref={trigger}
        aria-label={label}
        size="sm"
        class="w-auto max-w-full min-w-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent class="font-sans">
        {#each versions as version (version.value)}<SelectItem
            value={version.value}
            label={version.label}>{version.label}</SelectItem
          >{/each}
      </SelectContent>
    </Select>
  </label>{/if}
{#if part === "open" && open}<div
    data-doc-version-open
    class="flex min-h-0 flex-1 flex-col overflow-auto"
  >
    <div
      role="status"
      class="m-3 mb-0 flex flex-wrap items-center gap-2 rounded-control border border-border bg-muted p-3 text-sm"
    >
      <b class="w-full"
        >{en ? "Version" : "Versão"}
        {number} · {when(open.ts)} · {who(open.by)}</b
      ><Button size="sm" variant="ghost" onclick={chat}
        >{en ? "See in the chat" : "Ver na conversa"}</Button
      ><Button size="sm" variant="default" onclick={restore}
        >{en ? "Restore" : "Restaurar"}</Button
      ><Button
        size="sm"
        variant="ghost"
        onclick={() => docVersionOpen.set(null)}
        >{en ? "Back to current" : "Voltar ao atual"}</Button
      >
    </div>
    {#key open.id}<DocumentPreview
        {owner}
        text={open.text}
        {epic}
        {props}
      />{/key}
  </div>{/if}
