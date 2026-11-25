<script module lang="ts">
  import type { Readable } from "svelte/store";
  import type { ComposerPhase, PollDraft } from "./drafts";
  /** What the dialog edits: the room composer's entry posts the poll; the Home's ask holds it until it is sent. */
  export type PollForm = {
    state: Readable<{
      poll: PollDraft;
      pollPhase: ComposerPhase;
      pollError: string;
      notice: string;
    }>;
    editPoll(patch: Partial<Omit<PollDraft, "revision">>): void;
    createPoll(): unknown;
    reviewPoll(): void;
  };
</script>

<script lang="ts">
  import {
    POLL_QUESTION_LIMIT,
    POLL_OPTION_LIMIT,
    POLL_MIN_OPTIONS,
    POLL_MAX_OPTIONS,
  } from "../../../shared/composition";
  import { untrack, onDestroy, tick } from "svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  let {
    form: entry,
    t,
    open = $bindable(false),
  }: {
    form: PollForm;
    t: (text: string, vars?: Record<string, string | number>) => string;
    open?: boolean;
  } = $props();
  let active = true,
    formElement = $state<HTMLFormElement | null>(null);
  onDestroy(() => {
    active = false;
  });
  function allowed(event?: Event) {
    return (
      active &&
      open &&
      !!formElement?.isConnected &&
      (!event ||
        (event.currentTarget instanceof HTMLElement &&
          event.currentTarget.isConnected))
    );
  }
  const draft = untrack(() => entry.state);
  const busy = $derived(
    $draft.pollPhase === "pending" || $draft.pollPhase === "unconfirmed",
  );
  let previousNotice = "";
  $effect(() => {
    const notice = $draft.notice;
    untrack(() => {
      if (notice !== previousNotice) {
        previousNotice = notice;
        if (notice === "poll-created") open = false;
      }
    });
  });
  function option(index: number, value: string) {
    if (!allowed()) return;
    entry.editPoll({
      options: $draft.poll.options.map((previous, i) =>
        i === index ? value : previous,
      ),
    });
  }
  const canAdd = $derived(
    !busy && $draft.poll.options.length < POLL_MAX_OPTIONS,
  );
  const canRemove = $derived(
    !busy && $draft.poll.options.length > POLL_MIN_OPTIONS,
  );
  /** Adds an empty option at the end and puts the cursor in it. */
  async function add() {
    if (!allowed() || !canAdd) return;
    entry.editPoll({ options: [...$draft.poll.options, ""] });
    await tick();
    const inputs = formElement?.querySelectorAll<HTMLInputElement>(
      "[data-poll-option] input",
    );
    inputs?.[inputs.length - 1]?.focus();
  }
  function remove(index: number) {
    if (!allowed() || !canRemove) return;
    entry.editPoll({
      options: $draft.poll.options.filter((_, i) => i !== index),
    });
  }
  /** Enter moves down the list; in the last option it opens a new one instead of submitting. */
  function enter(index: number, event: KeyboardEvent) {
    if (event.key !== "Enter" || event.isComposing || event.shiftKey) return;
    const last = index === $draft.poll.options.length - 1;
    if (last && !canAdd) return;
    event.preventDefault();
    if (last) void add();
    else
      formElement
        ?.querySelectorAll<HTMLInputElement>("[data-poll-option] input")
        [index + 1]?.focus();
  }
</script>

<Dialog bind:open>
  <DialogContent
    class="font-sans text-sm text-foreground"
    closeLabel={t("Fechar")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
  >
    <DialogHeader>
      <DialogTitle class="font-sans">{t("Nova votação")}</DialogTitle>
    </DialogHeader>
    <form
      bind:this={formElement}
      class="grid gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        if (allowed(event)) void entry.createPoll();
      }}
    >
      <Label class="grid gap-2"
        >{t("Pergunta (ex.: Qual cruzeiro?)")}<Input
          required
          maxlength={POLL_QUESTION_LIMIT}
          value={$draft.poll.question}
          disabled={busy}
          oninput={(event) => {
            if (allowed(event))
              entry.editPoll({ question: event.currentTarget.value });
          }}
        /></Label
      >
      <fieldset
        class="m-0 grid min-w-0 gap-2 border-0 border-t border-solid border-border p-0 pt-4"
      >
        <legend class="float-left p-0 text-sm font-medium">{t("Opções")}</legend
        >
        {#each $draft.poll.options as value, index}<div
            data-poll-option
            class="flex items-center gap-1.5"
          >
            <Input
              class="flex-1"
              aria-label={t("Opção {n}", { n: index + 1 })}
              placeholder={t("Opção {n}", { n: index + 1 })}
              maxlength={POLL_OPTION_LIMIT}
              {value}
              disabled={busy}
              oninput={(event) => option(index, event.currentTarget.value)}
              onkeydown={(event) => enter(index, event)}
            /><IconButton
              label={t("Remover opção")}
              data-poll-remove={index}
              class="text-muted-foreground"
              disabled={!canRemove}
              onclick={(event) => {
                if (allowed(event)) remove(index);
              }}><Icon icon="x" size={16} /></IconButton
            >
          </div>{/each}
        <Button
          variant="ghost"
          size="sm"
          data-poll-add
          class="justify-self-start text-muted-foreground"
          disabled={!canAdd}
          onclick={(event) => {
            if (allowed(event)) void add();
          }}><Icon icon="plus" size={16} />{t("Adicionar opção")}</Button
        >
      </fieldset>
      <label
        class="flex cursor-pointer items-center justify-between gap-3 border-t border-solid border-border pt-4"
        ><span>{t("Permitir várias respostas")}</span><Switch
          checked={$draft.poll.multi}
          disabled={busy}
          onCheckedChange={(multi) => {
            if (allowed()) entry.editPoll({ multi });
          }}
        /></label
      >
      {#if $draft.pollError}<p
          role="alert"
          class="m-0 text-sm text-destructive"
        >
          {$draft.pollError === "poll-invalid"
            ? t("Coloque pelo menos 2 opções.")
            : $draft.pollPhase === "unconfirmed"
              ? t(
                  "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
                )
              : $draft.pollError}
        </p>{/if}
      {#if $draft.pollPhase === "unconfirmed"}<p
          class="m-0 text-xs text-muted-foreground"
        >
          {t("Confira a votação na sala antes de tentar novamente.")}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (allowed(event)) entry.reviewPoll();
          }}>{t("Conferi a sala; manter rascunho")}</Button
        >{/if}
      <div class="flex justify-end gap-2">
        <Button variant="outline" onclick={() => (open = false)}
          >{t("Cancelar")}</Button
        ><Button
          type="submit"
          disabled={busy}
          aria-busy={$draft.pollPhase === "pending" || undefined}
          >{#if $draft.pollPhase === "pending"}<Spinner size="2xs" />{/if}{t(
            "Criar votação",
          )}</Button
        >
      </div>
    </form>
  </DialogContent>
</Dialog>
