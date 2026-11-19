<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { PanelProps, Reminder } from "../../app/panels";
  import { createRoomApi } from "../../app/transport";
  import { createRemindersSession, type ReminderIssue } from "./session";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    AlertTriangle,
    ChevronDown,
    ChevronRight,
    Plus,
  } from "../../lib/studio/icons";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import PaneEmpty from "../../lib/components/PaneEmpty.svelte";
  import PaneHeader from "../../lib/components/PaneHeader.svelte";
  import { paneIcons } from "../documents/paneIcons";
  let {
    room,
    vb,
    request,
    ask,
  }: Pick<PanelProps, "room" | "vb" | "request" | "ask"> = $props();
  const session = untrack(() => createRemindersSession(room.id));
  const view = session.state;
  let opened = $state<string[]>([]),
    deletion = $state<Reminder | null>(null),
    dialogOpen = $state(false);
  let panelRoot = $state<HTMLElement | null>(null),
    deleteTrigger = $state<HTMLElement | null>(null),
    newTrigger = $state<HTMLElement | null>(null),
    textInput = $state<HTMLTextAreaElement | null>(null);
  const list = $derived(room.reminders || []);
  const locale = $derived(vb.locale || "pt-BR");
  const ids = $props.id();
  const when = (ms: number) =>
    new Date(ms).toLocaleString(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const issueText = (issue?: ReminderIssue | null) =>
    !issue
      ? ""
      : issue.detail === "upload-in-progress"
        ? vb.t(
            "Um envio deste lembrete ainda está em andamento. Aguarde antes de salvar novamente.",
          )
        : issue.detail === "reminder-processing-unconfirmed"
          ? vb.t(
              "Não recebi a confirmação do agendamento. Confira antes de tentar de novo.",
            )
          : ["offline", "disconnected"].includes(issue.detail)
            ? vb.t("sem conexão")
            : issue.kind === "unconfirmed" || issue.detail === "timeout"
              ? vb.t(
                  "Ainda não recebi a confirmação. Confira antes de tentar de novo.",
                )
              : issue.detail;
  $effect(() => {
    session.sync(list);
  });
  onDestroy(() => session.dispose());
  function open(draft: { name: string; text: string; fixed?: boolean }) {
    session.open(draft);
    queueMicrotask(() => textInput?.focus());
  }
  function cancel() {
    session.cancel();
    queueMicrotask(() => newTrigger?.focus());
  }
  function disclose(id: string) {
    opened = opened.includes(id)
      ? opened.filter((value) => value !== id)
      : [...opened, id];
  }
  async function remove() {
    const reminder = deletion;
    if (!reminder) return;
    const confirmed = await session.mutate(reminder.id, "delete", request);
    if (confirmed && deletion?.id === reminder.id) dialogOpen = false;
  }
</script>

<section
  bind:this={panelRoot}
  tabindex="-1"
  data-reminders-panel
  class="space-y-4 p-4 font-sans text-sm text-foreground"
>
  {#snippet newButton()}<Button
      id="remNew"
      bind:ref={newTrigger}
      onclick={() => open({ name: "", text: "" })}
      ><Icon icon={Plus} size={16} />{vb.t("Novo lembrete")}</Button
    >{/snippet}
  <PaneHeader
    title={vb.t("Lembretes")}
    count={list.length}
    description={list.length
      ? vb.t(
          "Quando o lembrete roda, o @vibe publica o texto aqui para seu agent.",
        )
      : undefined}
    action={list.length && !$view.draft ? newButton : undefined}
  />
  {#if $view.draft}
    <Card>
      <form
        id="remForm"
        class="space-y-4"
        onsubmit={(event) => {
          event.preventDefault();
          void session.save(createRoomApi(room.id).uploadFile);
        }}
      >
        <div class="space-y-2">
          <Label for={`${ids}-name`}>{vb.t("Nome")}</Label><Input
            id={`${ids}-name`}
            name="name"
            maxlength={60}
            required
            readonly={$view.draft.fixed}
            value={$view.draft.name}
            oninput={(event) =>
              session.edit({ name: event.currentTarget.value })}
            placeholder={vb.t("nome, ex.: relatorio-diario")}
          />
        </div>
        <div class="space-y-2">
          <Label for={`${ids}-text`}>{vb.t("Texto do lembrete")}</Label
          ><Textarea
            id={`${ids}-text`}
            bind:ref={textInput}
            name="text"
            required
            value={$view.draft.text}
            oninput={(event) =>
              session.edit({ text: event.currentTarget.value })}
            placeholder={vb.t(
              "Diga quando e o quê. Ex.: Todo dia às 8h: puxe os números de ontem e poste aqui o que mudou.",
            )}
          />
        </div>
        {#if $view.issue}<p
            id="remErr"
            role="alert"
            class="m-0 whitespace-pre-wrap text-sm text-destructive"
          >
            {issueText($view.issue)}
          </p>{/if}
        <div class="flex flex-wrap justify-end gap-2">
          <Button id="remCancel" variant="outline" onclick={cancel}
            >{vb.t("Cancelar")}</Button
          ><Button
            id="remSave"
            type="submit"
            disabled={$view.saving}
            aria-busy={$view.saving || undefined}
            >{#if $view.saving}<Spinner size="2xs" />{/if}{vb.t(
              "Salvar",
            )}</Button
          >
        </div>
      </form>
    </Card>
  {/if}
  <div class="space-y-3">
    {#each list as reminder (reminder.id)}
      {@const pending = $view.pending[reminder.id]}
      {@const issue = $view.rowIssues[reminder.id]}
      <Card class="space-y-3 p-4">
        <div class="flex items-start gap-2">
          <button
            type="button"
            data-rem-open={reminder.id}
            aria-expanded={opened.includes(reminder.id)}
            aria-controls={`${ids}-content-${reminder.id}`}
            onclick={() => disclose(reminder.id)}
            class="flex min-w-0 flex-1 items-start gap-2 rounded-control border-0 bg-transparent p-1 text-left font-sans text-sm text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon
              icon={opened.includes(reminder.id) ? ChevronDown : ChevronRight}
              size={16}
              class="mt-0.5 shrink-0 text-muted-foreground"
            />
            <span class="min-w-0 space-y-1"
              ><span class="block break-words font-medium"
                >{reminder.name ? `${reminder.name}.md` : reminder.text}</span
              ><span class="block text-xs leading-5 text-muted-foreground"
                >{#if !reminder.error}{reminder.every ||
                    reminder.cron ||
                    ""}{reminder.enabled && reminder.next_at
                    ? ` · ${vb.t("próximo {when}", { when: when(reminder.next_at) })}`
                    : ""} ·
                {/if}{vb.t("de {who}", { who: vb.name(reminder.owner) })}</span
              ></span
            >
          </button>
        </div>
        {#if reminder.error}<p
            role="status"
            class="m-0 flex items-start gap-2 whitespace-pre-wrap text-sm text-destructive"
          >
            <Icon icon={AlertTriangle} size={16} />{reminder.error}
          </p>{/if}
        <pre
          hidden={!opened.includes(reminder.id)}
          id={`${ids}-content-${reminder.id}`}
          class="m-0 whitespace-pre-wrap break-words rounded-control bg-muted p-3 font-mono text-xs leading-5">{reminder.text}</pre>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <Label class="flex items-center gap-2">
            <Switch
              data-rem-on={reminder.id}
              bind:checked={
                () => reminder.enabled,
                (desired) => {
                  void session.mutate(reminder.id, "enable", request, desired);
                }
              }
              disabled={!!reminder.error || !!pending}
            />{vb.t("Ligado")}
          </Label>
          <div class="flex flex-wrap gap-2">
            {#if reminder.name}<Button
                variant="ghost"
                size="sm"
                data-rem-edit={reminder.id}
                onclick={() =>
                  open({
                    name: reminder.name!,
                    text: reminder.text,
                    fixed: true,
                  })}>{vb.t("Editar")}</Button
              >{/if}<Button
              variant="ghost"
              size="sm"
              data-rem-del={reminder.id}
              disabled={!!pending}
              onclick={(event) => {
                deletion = reminder;
                deleteTrigger = event.currentTarget;
                dialogOpen = true;
              }}>{vb.t("Apagar lembrete")}</Button
            >
          </div>
        </div>
        {#if pending}<p role="status" class="m-0 text-xs text-muted-foreground">
            {vb.t("Aguardando confirmação…")}
          </p>{/if}
        {#if issue}<p
            role="alert"
            class="m-0 whitespace-pre-wrap text-sm text-destructive"
          >
            {issueText(issue)}
          </p>{/if}
      </Card>
    {:else}{#if !$view.draft}<PaneEmpty
          icon={paneIcons.reminders}
          title={vb.t("Nenhum lembrete ainda")}
          description={vb.t(
            "Algo que roda num horário. Na hora, o @vibe posta o texto na sala e seu Claude faz.",
          )}
          action={newButton}
          ask={vb.t(
            "Todo dia útil às 8h, posta um resumo do que mudou nesta sala.",
          )}
          askLabel={vb.t("Peça pro seu Claude")}
          onask={ask}
        />{/if}{/each}
  </div>
</section>
<ConfirmDialog
  bind:open={dialogOpen}
  title={vb.t("Apagar este lembrete?")}
  description={deletion?.name ? `${deletion.name}.md` : deletion?.text}
  confirmLabel={vb.t("Apagar lembrete")}
  cancelLabel={vb.t("Cancelar")}
  busy={!!(deletion && $view.pending[deletion.id])}
  error={deletion ? issueText($view.rowIssues[deletion.id]) : ""}
  onconfirm={() => {
    void remove();
  }}
  returnFocus={() =>
    deleteTrigger?.isConnected ? deleteTrigger : newTrigger || panelRoot}
/>
