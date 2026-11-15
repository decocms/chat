<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { PanelProps } from "../../panels";
  import type { DocumentProps } from "./types";
  import RichNodes from "../rich-text/RichNodes.svelte";
  import { createRichSession } from "../rich-text/session";
  import {
    createRichPreparation,
    loadHtmlTree,
    type HtmlTreeLoader,
  } from "../rich-text/preparation";
  import RichPreparationStatus from "../rich-text/RichPreparationStatus.svelte";
  import { scopedRichFileIndex } from "../rich-text/fileContext";
  import type { DocumentSession } from "./session";
  import type { RichActions, RichContext } from "../rich-text/types";
  import Tasks from "../../Tasks.svelte";
  import Mermaid from "./Mermaid.svelte";
  import {
    documentBlocks,
    documentAppNodes,
    mermaidSource,
    documentCardSource,
  } from "./preview";
  import DeferredDocumentCard from "./DeferredDocumentCard.svelte";
  import {
    documentAppMarkers,
    resizeDocumentApp,
    documentAppKey,
    createDocumentAppAuthority,
  } from "./appMarkers";
  import DeferredDocumentApp from "./DeferredDocumentApp.svelte";
  let {
    text,
    epic,
    props,
    owner,
    loadHtml,
  }: {
    text: string;
    epic: string | null;
    props: DocumentProps;
    owner: DocumentSession;
    loadHtml?: HtmlTreeLoader;
  } = $props();
  const idPrefix = $props.id();
  const fileIndex = scopedRichFileIndex();
  const binding = untrack(() => ({
    account: props.room.me,
    roomId: props.room.id,
    epicId: epic,
  }));
  let active = true;
  onDestroy(() => (active = false));
  const current = () => {
    const target = owner.target();
    return (
      active &&
      owner.authorized() &&
      target?.account === binding.account &&
      target.roomId === binding.roomId &&
      target.epicId === binding.epicId
    );
  };
  const actions: RichActions = {
    navigate: (id, thread) => {
      if (current()) props.actions.navigate(id, thread);
    },
    openFile: (file) => {
      if (current()) props.actions.openFile(file);
    },
    navigateRich: (target) => {
      if (current()) props.actions.navigateRich?.(target);
    },
    openFileReference: (file) => {
      if (current()) props.actions.openFileReference?.(file);
    },
    ensureFileIndex: () => {
      if (current()) props.actions.ensureFileIndex?.();
    },
  };
  const taskProps: PanelProps = $derived({
    ...props.taskProps,
    send: (command) => (current() ? props.taskProps.send(command) : false),
    request: (command) =>
      current()
        ? props.taskProps.request(command)
        : Promise.resolve({ ok: false, error: "disconnected" }),
  });
  const context: RichContext = $derived({
    room: props.room,
    pageUrl: location.href,
    idPrefix,
    policy: "document",
    fileLabel: props.taskProps.vb.t("arquivo"),
    fileIndex,
  });
  const session = createRichSession();
  onDestroy(() => session.dispose());
  const preparation = createRichPreparation({
    load: (signal) => (loadHtml ?? loadHtmlTree)(signal),
    current: (input) =>
      current() &&
      input.source === text &&
      input.scope === JSON.stringify([props.room.me, props.room.id, epic]),
  });
  onDestroy(() => preparation.dispose());
  const prepared = $derived(
    preparation.read({
      source: text,
      mode: "markdown",
      policy: "document",
      scope: JSON.stringify([props.room.me, props.room.id, epic]),
    }),
  );
  const nodes = $derived(
    $prepared.phase === "ready"
      ? session.project($prepared.parsed, context)
      : [],
  );
  const hasTasks = $derived(
    !!epic || (props.thread === "main" && !!props.room.roomTasks?.length),
  );
  const literal = $derived(nodes.length === 1 && nodes[0].kind === "text");
  const blocks = $derived(
    documentBlocks(
      props.apps ? documentAppNodes(nodes, text) : nodes,
      hasTasks,
    ),
  );
  const appMarkers = $derived(documentAppMarkers(text));
  function blockKey(
    block: ReturnType<typeof documentBlocks>[number],
    index: number,
  ) {
    const keys: string[] = [];
    function collect(node: import("../rich-text/types").RichNode) {
      if (node.kind === "element" && node.documentAppSlot !== undefined)
        keys.push(documentAppKey(appMarkers[node.documentAppSlot]!));
      else if ("children" in node) node.children.forEach(collect);
    }
    if ("node" in block) collect(block.node);
    return keys.length ? "apps:" + JSON.stringify(keys) : "block:" + index;
  }
  const appCurrent = createDocumentAppAuthority(
    () => get(owner.state).text,
    current,
  );
</script>

{#snippet appSlot(index: number)}
  {#if props.apps && appMarkers[index]}
    <DeferredDocumentApp
      props={props.apps}
      marker={appMarkers[index]!}
      source={text}
      current={appCurrent}
      resize={(source, marker, size) => {
        if (!current()) return;
        const target = owner.target();
        if (!target) return;
        const next = resizeDocumentApp(source, marker, size);
        if (next !== null) owner.rewrite(target, source, next);
      }}
      open={() => {
        const marker = appMarkers[index];
        if (current() && marker) props.openApp?.(marker);
      }}
    />
  {/if}
{/snippet}

{#snippet taskSlot()}<section data-document-tasks class="tw:my-3">
    <Tasks {...taskProps} thread={epic ?? "main"} />
  </section>{/snippet}
{#snippet cardSlot(source: string, node: import("../rich-text/types").RichNode)}
  <DeferredDocumentCard
    {source}
    room={props.room}
    actions={{
      ...actions,
      openApp: (target) => {
        if (current()) props.openApp?.(target);
      },
    }}
    t={props.taskProps.vb.t}
    {current}
    lang={props.lang}
    >{#snippet fallback()}<RichNodes
        nodes={[node]}
        {actions}
      />{/snippet}</DeferredDocumentCard
  >
{/snippet}
<div
  data-document-preview
  data-vb-native
  class="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto tw:p-4 tw:font-sans tw:text-foreground tw:break-words"
>
  {#if $prepared.phase !== "ready"}<RichPreparationStatus
      phase={$prepared.phase}
      retry={() => preparation.retry()}
      lang={props.lang}
    />{/if}
  {#if !epic && props.room.docNotes?.length}<aside
      aria-label={props.lang === "en"
        ? "Document review"
        : "Revisão do documento"}
      class="tw:mb-3 tw:space-y-1 tw:rounded-control tw:border tw:border-border tw:bg-muted tw:p-3 tw:text-sm tw:text-muted-foreground"
    >
      {#each props.room.docNotes as note}<p class="tw:m-0">{note}</p>{/each}
    </aside>{/if}
  {#if !text.trim()}<p class="tw:m-0 tw:text-muted-foreground">
      {props.lang === "en"
        ? "This document is empty. Choose Edit or ask your agent to summarize the decisions here."
        : "Documento vazio. Clique em Editar ou peça pro seu agent resumir as decisões aqui."}
    </p>{/if}
  {#if literal && text.trim()}<p
      role="status"
      class="tw:my-2 tw:text-xs tw:text-muted-foreground"
    >
      {props.lang === "en"
        ? "Preview shown as plain text. The full document remains available to read, copy and edit."
        : "Prévia em texto simples. O documento completo continua disponível para ler, copiar e editar."}
    </p>{/if}
  {#each blocks as block, index (blockKey(block, index))}
    {#if "tasks" in block}<section data-document-tasks class="tw:my-3">
        <Tasks {...taskProps} thread={epic ?? "main"} />
      </section>
    {:else}{@const diagram = mermaidSource(
        block.node,
      )}{#if diagram !== null}<Mermaid
          source={diagram}
          {context}
          {actions}
          lang={props.lang}
        />{:else}<div
          class={block.node.kind === "text"
            ? "tw:whitespace-pre-wrap tw:break-words"
            : "tw:min-w-0"}
        >
          <RichNodes
            nodes={[block.node]}
            {actions}
            {taskSlot}
            {appSlot}
            {cardSlot}
            cardSource={documentCardSource}
            appKey={(index) => documentAppKey(appMarkers[index]!)}
          />
        </div>{/if}{/if}
  {/each}
</div>
