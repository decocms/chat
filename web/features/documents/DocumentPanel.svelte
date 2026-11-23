<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type {
    DocumentSession,
    OrphanedDocumentDraft,
    RecoveryToken,
  } from "./session";
  import type { DocumentProps } from "./types";
  import DocumentPreview from "./DocumentPreview.svelte";
  import DocumentVersions from "./DocumentVersions.svelte";
  import { docVersionOpen } from "./versions";
  import Button from "../../lib/studio/Button.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  let { owner, props }: { owner: DocumentSession; props: DocumentProps } =
    $props();
  const view = untrack(() => owner.state);
  let active = true,
    copyNotice = $state("");
  onDestroy(() => (active = false));
  async function copyOrphan(snapshot: OrphanedDocumentDraft) {
    if (!active || !owner.ownsOrphan(snapshot)) return;
    const key = JSON.stringify(owner.target());
    try {
      if (!navigator.clipboard) throw Error("Unavailable");
      await navigator.clipboard.writeText(snapshot.text);
      if (
        active &&
        owner.ownsOrphan(snapshot) &&
        JSON.stringify(owner.target()) === key
      )
        copyNotice = en ? "Copied" : "Copiado";
    } catch {
      if (
        active &&
        owner.ownsOrphan(snapshot) &&
        JSON.stringify(owner.target()) === key
      )
        copyNotice = en
          ? "Clipboard unavailable. Select the retained text to copy it."
          : "Área de transferência indisponível. Selecione o texto guardado para copiar.";
    }
  }
  const recoveryToken = $derived.by(() => {
    $view.recovery;
    $view.target;
    return owner.recoveryToken();
  });
  function recoveryFrom(event: Event): RecoveryToken | null {
    const element = event.currentTarget;
    if (!(element instanceof HTMLElement)) return null;
    const key = element.dataset.documentRecoveryKey,
      revision = Number(element.dataset.documentRecoveryRevision);
    return key && Number.isSafeInteger(revision) ? { key, revision } : null;
  }
  async function copyRecovery(event: Event) {
    if (!connected(event) || !active) return;
    const token = recoveryFrom(event),
      text = owner.recoveryText(token);
    if (text === null) return;
    try {
      if (!navigator.clipboard) throw Error("Unavailable");
      await navigator.clipboard.writeText(text);
      if (active && owner.recoveryText(token) === text)
        copyNotice = en ? "Copied" : "Copiado";
    } catch {
      if (active && owner.recoveryText(token) === text)
        copyNotice = en
          ? "Clipboard unavailable. Select the retained text to copy it."
          : "Área de transferência indisponível. Selecione o texto guardado para copiar.";
    }
  }
  const en = $derived(props.lang === "en");
  const epic = $derived(
    props.room.epics.find((epic) => epic.id === props.thread),
  );
  $effect(() => {
    JSON.stringify($view.target);
    copyNotice = "";
  });
  const editable = $derived(
    !$view.denied && props.room.members.includes(props.room.me),
  );
  const connected = (event: Event) =>
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  function editor(node: HTMLElement) {
    const detach = owner.attach(node);
    return { destroy: detach };
  }
</script>

<section
  data-document
  hidden={props.pane !== "doc"}
  class="min-h-0 min-w-0 flex-1 flex-col bg-background font-sans text-foreground [&:not([hidden])]:flex"
>
  {#if epic}<nav
      aria-label={en ? "Document scope" : "Escopo do documento"}
      class="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2"
    >
      <Button
        size="sm"
        variant={$view.target?.epicId ? "ghost" : "secondary"}
        aria-pressed={!$view.target?.epicId}
        onclick={(event) => {
          if (connected(event)) owner.chooseRoom(true);
        }}>{props.room.book.title || "deco.chat"}</Button
      ><span aria-hidden="true">›</span><Button
        size="sm"
        variant={$view.target?.epicId ? "secondary" : "ghost"}
        aria-pressed={!!$view.target?.epicId}
        onclick={(event) => {
          if (connected(event)) owner.chooseRoom(false);
        }}>{epic.title}</Button
      >
    </nav>{/if}
  {#if $view.orphaned.length}<aside
      role="status"
      class="space-y-2 border-b border-border bg-muted p-3"
    >
      <p class="m-0 text-sm">
        {en
          ? "Retained edits belong to threads that no longer exist. They will never be sent to another document."
          : "Edições guardadas pertencem a threads que não existem mais. Elas nunca serão enviadas para outro documento."}
      </p>
      {#each $view.orphaned as draft (draft.epicId)}<details>
          <summary class="cursor-pointer text-sm">{draft.epicId}</summary>
          <pre
            class="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{draft.text}</pre>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onclick={(event) => {
                if (connected(event) && active) void copyOrphan(draft);
              }}>{en ? "Copy retained text" : "Copiar texto guardado"}</Button
            ><Button
              variant="outline"
              size="sm"
              onclick={(event) => {
                if (connected(event) && active) owner.discardOrphan(draft);
              }}>{en ? "Discard" : "Descartar"}</Button
            >
          </div>
        </details>{/each}{#if copyNotice}<p
          aria-live="polite"
          class="m-0 text-xs"
        >
          {copyNotice}
        </p>{/if}
    </aside>{/if}
  {#if $view.readPending}<p
      role="status"
      class="m-0 p-3 text-sm text-muted-foreground"
    >
      {en ? "Loading document…" : "Carregando documento…"}
    </p>{/if}
  {#if $view.fallbackUnconfirmed}<p
      role="alert"
      class="m-0 p-3 text-sm text-destructive"
    >
      {en
        ? "The last edit was not confirmed. Your text is retained; review it before retrying live editing."
        : "A última edição não foi confirmada. Seu texto está guardado; revise antes de tentar a edição ao vivo."}
    </p>{/if}
  {#if $view.recovery !== null}<aside
      role="status"
      class="space-y-2 border-b border-border bg-muted p-3"
    >
      <p class="m-0 text-sm">
        {en
          ? "An earlier local edit was not confirmed. Review it before replacing the current document."
          : "Uma edição local anterior não foi confirmada. Revise antes de substituir o documento atual."}
      </p>
      <details>
        <summary class="cursor-pointer text-sm"
          >{en ? "Review retained text" : "Revisar texto guardado"}</summary
        >
        <pre
          class="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs">{$view.recovery}</pre>
      </details>
      <div class="flex gap-2">
        <Button
          data-document-recovery-key={recoveryToken?.key}
          data-document-recovery-revision={recoveryToken?.revision}
          size="sm"
          disabled={$view.mode !== "edit" ||
            !editable ||
            !(
              $view.status === "fallback" ||
              ($view.status === "connected" && $view.synced)
            )}
          onclick={(event) => {
            if (connected(event)) owner.restore(recoveryFrom(event));
          }}>{en ? "Use retained text" : "Usar texto guardado"}</Button
        ><Button
          variant="outline"
          size="sm"
          data-document-recovery-key={recoveryToken?.key}
          data-document-recovery-revision={recoveryToken?.revision}
          onclick={(event) => {
            if (connected(event)) owner.dismissRecovery(recoveryFrom(event));
          }}>{en ? "Discard retained text" : "Descartar texto guardado"}</Button
        >
        <Button
          size="sm"
          variant="outline"
          data-document-recovery-key={recoveryToken?.key}
          data-document-recovery-revision={recoveryToken?.revision}
          onclick={(event) => {
            void copyRecovery(event);
          }}>{en ? "Copy retained text" : "Copiar texto guardado"}</Button
        >
      </div>
      {#if copyNotice}<p role="status" class="m-0 text-xs">
          {copyNotice}
        </p>{/if}
    </aside>{/if}
  {#if $view.denied}<p role="alert" class="m-0 p-3 text-sm text-destructive">
      {$view.checkingAccess
        ? en
          ? "Checking document access…"
          : "Verificando acesso ao documento…"
        : en
          ? "Document access must be checked again. Only your retained local text is available."
          : "O acesso ao documento precisa ser verificado novamente. Apenas seu texto local guardado está disponível."}<Button
        variant="outline"
        size="sm"
        onclick={(event) => {
          if (connected(event) && active) props.onAuthorize();
        }}>{en ? "Check access again" : "Verificar acesso novamente"}</Button
      >
    </p>{/if}
  {#if !$view.denied && $view.mode === "preview"}<DocumentVersions
      {owner}
      {props}
      epic={$view.target?.epicId ?? null}
      part="open"
    />{/if}
  {#if !$view.denied}<div
      hidden={$view.mode !== "preview" || !!$docVersionOpen}
      class="min-h-0 flex-1 flex-col [&:not([hidden])]:flex"
    >
      {#key JSON.stringify( [props.room.me, props.room.id, $view.target?.epicId] )}<DocumentPreview
          {owner}
          text={$view.text}
          epic={$view.target?.epicId ?? null}
          {props}
          >{#snippet aside()}<DocumentVersions
              {owner}
              {props}
              epic={$view.target?.epicId ?? null}
              part="picker"
            />{/snippet}</DocumentPreview
        >{/key}
    </div>{/if}
  <div
    hidden={$view.denied ||
      $view.mode !== "edit" ||
      $view.status === "fallback"}
    use:editor
    data-document-editor
    class="min-h-0 flex-1 overflow-auto [&:not([hidden])]:flex [&_.cm-editor]:min-w-0 [&_.cm-editor]:flex-1 [&_.cm-editor]:bg-transparent [&_.cm-scroller]:overflow-auto [&_.cm-scroller]:p-4 [&_.cm-scroller]:font-mono [&_.cm-scroller]:text-base [&_.cm-scroller]:leading-6 [&_.cm-content]:caret-foreground [&_.cm-cursor]:border-l-2 [&_.cm-cursor]:border-foreground [&_.cm-dropCursor]:border-foreground [&_.cm-selectionBackground]:bg-accent! [&_.cm-ySelectionInfo]:rounded-sm [&_.cm-ySelectionInfo]:px-1 [&_.cm-ySelectionInfo]:font-sans! [&_.cm-ySelectionInfo]:text-xs! [&_.cm-ySelectionInfo]:font-medium! [&_.cm-ySelectionInfo]:leading-4!"
  ></div>
  {#if !$view.denied}{#if $view.mode === "edit" && $view.status === "fallback"}<div
        class="flex min-h-0 flex-1 flex-col p-3"
      >
        <p role="status" class="my-2 text-sm text-muted-foreground">
          {en
            ? "Live editing could not start. Plain-text changes use the room connection and may conflict with other edits."
            : "A edição ao vivo não iniciou. Alterações em texto simples usam a conexão da sala e podem conflitar com outras edições."}
        </p>
        <Textarea
          aria-label={en ? "Document editor" : "Editor do documento"}
          value={$view.text}
          disabled={!editable}
          class="min-h-64 flex-1 resize-none p-4 font-mono text-base leading-6"
          oninput={(event) => {
            if (connected(event)) owner.input(event.currentTarget.value);
          }}
        /><Button
          variant="outline"
          size="sm"
          onclick={(event) => {
            if (connected(event)) owner.retry();
          }}>{en ? "Retry live editing" : "Tentar edição ao vivo"}</Button
        >
      </div>{/if}
    {#if $view.mode === "edit"}<p
        role="status"
        aria-live="polite"
        class="m-0 border-t border-border px-3 py-2 text-xs text-muted-foreground"
      >
        {$view.fallbackPending
          ? en
            ? "Changes sent or queued locally; confirmation is pending."
            : "Alterações enviadas ou guardadas localmente; confirmação pendente."
          : $view.status === "connected" && $view.synced
            ? en
              ? "Live connection synchronized. Server persistence is asynchronous."
              : "Conexão ao vivo sincronizada. A gravação no servidor é assíncrona."
            : $view.status === "fallback"
              ? en
                ? "Plain-text fallback"
                : "Edição em texto simples"
              : en
                ? "Connecting or reconnecting; keep this page open for local edits."
                : "Conectando; mantenha a página aberta para suas edições locais."}
      </p>{/if}
    {#if $view.error && $view.status !== "fallback"}<p
        role="alert"
        class="m-0 p-3 text-sm text-destructive"
      >
        {en
          ? "Document request could not be confirmed."
          : "Não foi possível confirmar o pedido do documento."}<Button
          variant="outline"
          size="sm"
          onclick={(event) => {
            if (connected(event)) owner.retry();
          }}>{en ? "Try again" : "Tentar novamente"}</Button
        >
      </p>{/if}
    <!-- An empty doc carries its own "Start writing"; the foot bar comes back once there is text. -->
    {#if $view.mode === "edit" || $view.text.trim()}
      <footer class="flex p-3">
        <Button
          disabled={!editable}
          variant={$view.mode === "edit" ? "default" : "outline"}
          class="w-full rounded-full"
          aria-pressed={$view.mode === "edit"}
          onclick={(event) => {
            if (connected(event))
              owner.mode($view.mode === "edit" ? "preview" : "edit");
          }}
          >{#if $view.mode !== "edit"}<Icon
              icon="pencil-01"
              size={16}
            />{/if}{$view.mode === "edit"
            ? en
              ? "Done"
              : "Pronto"
            : en
              ? "Edit"
              : "Editar"}</Button
        >
      </footer>{/if}
  {/if}
</section>
