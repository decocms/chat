<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Decision, PanelProps } from "../../panels";
  import { createDecisionsSession, decisionRows } from "./model";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { X } from "../../lib/studio/icons";
  import Icon from "../../lib/studio/Icon.svelte";
  import PaneEmpty from "../../lib/components/PaneEmpty.svelte";
  import PaneHeader from "../../lib/components/PaneHeader.svelte";
  import { paneIcons } from "../documents/paneIcons";
  let {
    room,
    vb,
    request,
    ask,
  }: Pick<PanelProps, "room" | "vb" | "request" | "ask"> = $props();
  const session = untrack(() => createDecisionsSession(room.id));
  const view = session.state;
  const list = $derived(room.decisions || []);
  const rows = $derived(decisionRows(list));
  let deletion = $state<Decision | null>(null);
  let dialogOpen = $state(false);
  let deleteTrigger = $state<HTMLElement | null>(null);
  let panelRoot = $state<HTMLElement | null>(null);
  const issueText = (issue?: string) =>
    !issue
      ? ""
      : ["offline", "disconnected"].includes(issue)
        ? vb.t("sem conexão")
        : ["timeout", "unconfirmed"].includes(issue)
          ? vb.t(
              "Ainda não recebi a confirmação. Confira antes de tentar de novo.",
            )
          : issue;
  $effect(() => {
    session.sync(list);
    if (deletion && !list.some((d) => d.id === deletion!.id)) {
      dialogOpen = false;
      deletion = null;
    }
  });
  onDestroy(() => session.dispose());
</script>

<section
  bind:this={panelRoot}
  tabindex="-1"
  data-decisions-panel
  class="space-y-4 p-4 font-sans text-sm text-foreground"
>
  <PaneHeader title={vb.t("Decisões")} count={list.length} />
  {#each rows as decision (decision.id)}
    <article data-decision-id={decision.id}>
      <Card size="tile" class="flex-row items-start gap-3">
        <div class="min-w-0 flex-1 space-y-2">
          <p class="m-0 whitespace-pre-wrap break-words leading-6">
            {decision.text}
          </p>
          <div
            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <Badge
              class="text-foreground"
              variant={decision.kind === "approval" ? "success" : "neutral"}
              >{decision.kind === "approval"
                ? `✓ ${vb.t("aprovado")}`
                : vb.t("decidido")}</Badge
            >
            <span class="break-words">{decision.who}</span><time
              datetime={new Date(decision.ts).toISOString()}
              >{vb.ago(decision.ts)}</time
            >
          </div>
          {#if $view.pending[decision.id]}<p
              role="status"
              class="m-0 text-xs text-muted-foreground"
            >
              {vb.t("Aguardando confirmação…")}
            </p>{/if}
          {#if $view.issues[decision.id]}<p
              role="alert"
              class="m-0 whitespace-pre-wrap break-words text-sm text-destructive"
            >
              {issueText($view.issues[decision.id])}
            </p>{/if}
        </div>
        <IconButton
          data-ddel={decision.id}
          label={vb.t("Apagar registro")}
          disabled={!!$view.pending[decision.id]}
          onclick={(event) => {
            deletion = decision;
            deleteTrigger = event.currentTarget;
            dialogOpen = true;
          }}><Icon icon={X} size={16} /></IconButton
        >
      </Card>
    </article>
  {:else}
    <PaneEmpty
      icon={paneIcons.decisions}
      title={vb.t("Nenhuma decisão ainda")}
      description={vb.t(
        "O que a sala decide e cada aprovação, com quem decidiu e quando, pra ninguém precisar caçar no chat.",
      )}
      ask={vb.t(
        "Lê a conversa desta sala e registra as decisões que a gente já tomou.",
      )}
      askLabel={vb.t("Peça pro seu Claude")}
      onask={ask}
    />
  {/each}
</section>
<ConfirmDialog
  bind:open={dialogOpen}
  title={vb.t("Apagar esse registro?")}
  description={deletion?.text}
  confirmLabel={vb.t("Apagar registro")}
  cancelLabel={vb.t("Cancelar")}
  busy={!!(deletion && $view.pending[deletion.id])}
  error={deletion ? issueText($view.issues[deletion.id]) : ""}
  onconfirm={() => {
    if (deletion) void session.remove(room.id, deletion.id, request);
  }}
  returnFocus={() => (deleteTrigger?.isConnected ? deleteTrigger : panelRoot)}
/>
