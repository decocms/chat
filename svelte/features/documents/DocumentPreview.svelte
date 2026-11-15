<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { PanelProps } from "../../panels";
  import type { DocumentProps } from "./types";
  import RichNodes from "../rich-text/RichNodes.svelte";
  import { createRichSession } from "../rich-text/session";
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
  import { threadWorkers } from "../chat/model";
  let {
    text,
    epic,
    props,
    owner,
  }: {
    text: string;
    epic: string | null;
    props: DocumentProps;
    owner: DocumentSession;
  } = $props();
  const idPrefix = $props.id();
  // A question just became this epic and its Claude is on it, but the doc is still the seed (Gui #2720): show that
  // the answer is coming instead of an empty doc. Seed = epicDocSeed's empty Contexto and Decisões.
  const SEED =
    /## Contexto\s*\n\s*-\s*\n[\s\S]*## Decisões\s*\n\s*-\s*(?:\n## Tarefas[\s\S]*)?$/;
  const isAnswer = $derived(
    !!epic && !!props.room.epics.find((e) => e.id === epic)?.answer,
  );
  // An answer epic's doc starts as just its title (+ the task list at the end, Gui #2767).
  const blank = $derived(
    SEED.test(text) ||
      (isAnswer &&
        !text
          .replace(/^#\s.*$/m, "")
          .replace(/##\s*Tarefas[\s\S]*$/, "")
          .trim()),
  );
  // Only an answer epic (a question): a work epic's seed doc is a plan template, not an answer on its way.
  const writer = $derived(
    epic && blank && isAnswer
      ? (threadWorkers(props.room, epic, Date.now())[0] ?? { who: "Claude" })
      : null,
  );
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
  const nodes = $derived(session.render(text, "markdown", context));
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
{#snippet writing()}{#if writer}<div
      role="status"
      data-doc-writing
      class="tw:my-4 tw:grid tw:gap-2"
    >
      <b class="tw:text-sm tw:font-semibold tw:text-primary"
        >✻ {props.lang === "en"
          ? `${writer.who || "Claude"} is writing the answer…`
          : `${writer.who || "Claude"} está escrevendo a resposta…`}</b
      >
      {#each ["tw:w-full", "tw:w-full", "tw:w-full", "tw:w-1/2"] as width}<i
          class="tw:block tw:h-3 tw:animate-pulse tw:rounded-md tw:bg-muted {width}"
        ></i>{/each}
    </div>{/if}{/snippet}
<div
  data-document-preview
  data-vb-native
  class="tw:min-h-0 tw:min-w-0 tw:flex-1 tw:overflow-auto tw:p-4 tw:font-sans tw:text-foreground tw:break-words"
>
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
    {#if "tasks" in block}{@render writing()}
      <section data-document-tasks class="tw:my-3">
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
  {#if writer && !blocks.some((block) => "tasks" in block)}{@render writing()}{/if}
</div>
