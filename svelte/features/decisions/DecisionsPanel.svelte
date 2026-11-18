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
  data-vb-native
  data-decisions-panel
  class="tw:space-y-4 tw:p-4 tw:font-sans tw:text-sm tw:text-foreground"
>
  <PaneHeader title={vb.t("Decisões")} count={list.length} />
  {#each rows as decision (decision.id)}
    <article data-decision-id={decision.id}>
      <Card size="tile" class="tw:flex-row tw:items-start tw:gap-3">
        <div class="tw:min-w-0 tw:flex-1 tw:space-y-2">
          <p class="tw:m-0 tw:whitespace-pre-wrap tw:break-words tw:leading-6">
            {decision.text}
          </p>
          <div
            class="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-xs tw:text-muted-foreground"
          >
            <Badge
              class="tw:text-foreground"
              variant={decision.kind === "approval" ? "success" : "neutral"}
              >{decision.kind === "approval"
                ? `✓ ${vb.t("aprovado")}`
                : vb.t("decidido")}</Badge
            >
            <span class="tw:break-words">{decision.who}</span><time
              datetime={new Date(decision.ts).toISOString()}
              >{vb.ago(decision.ts)}</time
            >
          </div>
          {#if $view.pending[decision.id]}<p
              role="status"
              class="tw:m-0 tw:text-xs tw:text-muted-foreground"
            >
              {vb.t("Aguardando confirmação…")}
            </p>{/if}
          {#if $view.issues[decision.id]}<p
              role="alert"
              class="tw:m-0 tw:whitespace-pre-wrap tw:break-words tw:text-sm tw:text-destructive"
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
