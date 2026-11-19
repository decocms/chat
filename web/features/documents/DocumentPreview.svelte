<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { get } from "svelte/store";
  import type { PanelProps } from "../../app/panels";
  import type { DocumentProps } from "./types";
  import RichNodes from "../rich-text/RichNodes.svelte";
  import { createRichSession } from "../rich-text/session";
  import { scopedRichFileIndex } from "../rich-text/fileContext";
  import type { DocumentSession } from "./session";
  import type { RichActions, RichContext } from "../rich-text/types";
  import Tasks from "../tasks/Tasks.svelte";
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
  import PaneEmpty from "../../lib/components/PaneEmpty.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Pencil01 } from "../../lib/studio/icons";
  import { paneIcons } from "./paneIcons";
  let {
    text,
    epic,
    props,
    owner,
    aside,
  }: {
    text: string;
    epic: string | null;
    props: DocumentProps;
    owner: DocumentSession;
    /** Floats right of the title, e.g. the version picker (Gui #2779). */
    aside?: import("svelte").Snippet;
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
  // An answer epic's doc is only the answer (Gui #2798): no task list in it.
  const hasTasks = $derived(
    (!!epic && !isAnswer) ||
      (props.thread === "main" && !!props.room.roomTasks?.length),
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

{#snippet taskSlot()}<section data-document-tasks class="my-3">
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
      class="my-4 grid gap-2"
    >
      <b class="text-sm font-semibold text-primary"
        >✻ {props.lang === "en"
          ? `${writer.who || "Claude"} is writing the answer…`
          : `${writer.who || "Claude"} está escrevendo a resposta…`}</b
      >
      {#each ["w-full", "w-full", "w-full", "w-1/2"] as width}<i
          class="block h-3 animate-pulse rounded-md bg-muted {width}"
        ></i>{/each}
    </div>{/if}{/snippet}
<div
  data-document-preview
  class="min-h-0 min-w-0 flex-1 overflow-auto p-4 font-sans text-foreground break-words"
>
  {#if !epic && text.trim() && props.room.docNotes?.length}<aside
      aria-label={props.lang === "en"
        ? "Document review"
        : "Revisão do documento"}
      class="mb-3 space-y-1 rounded-control border border-border bg-muted p-3 text-sm text-muted-foreground"
    >
      {#each props.room.docNotes as note}<p class="m-0">{note}</p>{/each}
    </aside>{/if}
  {#if aside}<div class="float-right mb-1 ml-3 mt-1">
      {@render aside()}
    </div>{/if}
  {#if !text.trim()}{@const en =
      props.lang ===
      "en"}{#snippet write()}{#if props.room.members.includes(props.room.me)}<Button
          onclick={() => owner.mode("edit")}
          ><Icon icon={Pencil01} size={16} />{en
            ? "Start writing"
            : "Começar a escrever"}</Button
        >{/if}{/snippet}<PaneEmpty
      icon={paneIcons.doc}
      title={epic
        ? en
          ? "This epic has no doc yet"
          : "Este épico ainda não tem doc"
        : en
          ? "Write what this room is for"
          : "Escreva pra que serve esta sala"}
      description={epic
        ? en
          ? "The plan, the decisions and what was delivered in this epic."
          : "O plano, as decisões e o que foi entregue neste épico."
        : en
          ? "The goal, what's in and what's out, and how you'll know it worked. Every Claude in the room reads this first."
          : "O objetivo, o que entra e o que fica de fora, e como saber que deu certo. Todo Claude da sala lê isto primeiro."}
      action={write}
      ask={epic
        ? en
          ? "Write this epic's doc: the plan, what's decided and what's left."
          : "Escreve o doc deste épico: o plano, o que já foi decidido e o que falta."
        : en
          ? "Read the project and write the room doc: goal, scope, success criterion and next steps."
          : "Lê o projeto e escreve o doc da sala: objetivo, escopo, critério de sucesso e próximos passos."}
      askLabel={en ? "Ask your Claude" : "Peça pro seu Claude"}
      onask={props.taskProps.ask}
    />{/if}
  {#if literal && text.trim()}<p
      role="status"
      class="my-2 text-xs text-muted-foreground"
    >
      {props.lang === "en"
        ? "Preview shown as plain text. The full document remains available to read, copy and edit."
        : "Prévia em texto simples. O documento completo continua disponível para ler, copiar e editar."}
    </p>{/if}
  {#each blocks as block, index (blockKey(block, index))}
    {#if "tasks" in block}{@render writing()}
      <section data-document-tasks class="my-3">
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
            ? "whitespace-pre-wrap break-words"
            : "min-w-0"}
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
