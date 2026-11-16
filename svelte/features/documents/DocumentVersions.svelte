<script lang="ts">
  // Doc versions (Gui #2666): pick a version of the doc on screen; an old one is shown read-only above the live doc
  // with Restaurar (writes it back as the live doc, itself a new version) and "Ver na conversa" (the chat at that
  // moment: the newest message of the doc's thread up to the version's msg_id).
  import { untrack } from "svelte";
  import type { DocumentProps } from "./types";
  import Button from "../../lib/studio/Button.svelte";
  import DocumentPreview from "./DocumentPreview.svelte";
  import Self from "./DocumentVersions.svelte";
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
    /** "picker" = the select, drawn on the title's line by DocumentPreview's aside; "open" = the old version's view
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
  function pick(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    if (value) props.send({ t: "doc.version", id: Number(value) });
    else docVersionOpen.set(null);
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

{#if part === "picker" && list.length}<div
    data-doc-versions
    class="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground"
  >
    <select
      aria-label={en ? "Doc versions" : "Versões do doc"}
      class="tw:max-w-full tw:rounded-control tw:border tw:border-border tw:bg-background tw:px-2 tw:py-1 tw:text-xs tw:text-foreground"
      onfocus={() => props.send({ t: "doc.versions", epic })}
      onchange={pick}
      ><option value="" selected={!open}
        >{en ? "Current (live)" : "Atual (ao vivo)"}</option
      >{#each list as v, i (v.id)}<option
          value={v.id}
          selected={open?.id === v.id}
          >v{list.length - i} · {when(v.ts)} · {who(v.by)}</option
        >{/each}</select
    >
  </div>{/if}
{#if part === "open" && open}<div
    data-doc-version-open
    class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-auto"
  >
    <div
      role="status"
      class="tw:m-3 tw:mb-0 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-control tw:border tw:border-border tw:bg-muted tw:p-3 tw:text-sm"
    >
      <b class="tw:w-full"
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
    {#key open.id}<DocumentPreview {owner} text={open.text} {epic} {props}
        >{#snippet aside()}<Self
            {owner}
            {props}
            {epic}
            part="picker"
          />{/snippet}</DocumentPreview
      >{/key}
  </div>{/if}
