<script lang="ts">
  import {
    POLL_QUESTION_LIMIT,
    POLL_OPTION_LIMIT,
    POLL_MAX_OPTIONS,
  } from "../../../shared/composition";
  import { untrack, onDestroy } from "svelte";
  import type { ComposerEntry } from "./drafts";
  import type { ChatBridge } from "../../chatTypes";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import Button from "../../lib/studio/Button.svelte";
  let {
    entry,
    vb,
    open = $bindable(false),
  }: { entry: ComposerEntry; vb: ChatBridge; open?: boolean } = $props();
  let active = true,
    form = $state<HTMLFormElement | null>(null);
  onDestroy(() => {
    active = false;
  });
  function allowed(event?: Event) {
    return (
      active &&
      open &&
      !!form?.isConnected &&
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
</script>

<Dialog bind:open>
  <DialogContent
    data-vb-native
    class="tw:font-sans tw:text-sm tw:text-foreground"
    closeLabel={vb.t("Fechar")}
    preventScroll={false}
    preventBodyPointerEvents={false}
    preventOverflowTextSelection={false}
  >
    <DialogHeader>
      <DialogTitle class="tw:font-sans">{vb.t("Nova votação")}</DialogTitle>
    </DialogHeader>
    <form
      bind:this={form}
      class="tw:grid tw:gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        if (allowed(event)) void entry.createPoll();
      }}
    >
      <Label class="tw:grid tw:gap-2"
        >{vb.t("Pergunta (ex.: Qual cruzeiro?)")}<Input
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
      <div class="tw:grid tw:gap-2">
        {#each $draft.poll.options as value, index}<Input
            aria-label={vb.t("Opção {n}", { n: index + 1 })}
            maxlength={POLL_OPTION_LIMIT}
            {value}
            disabled={busy}
            oninput={(event) => option(index, event.currentTarget.value)}
          />{/each}
      </div>
      <Button
        variant="link"
        class="tw:h-auto tw:justify-self-start tw:px-0 tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current"
        disabled={busy || $draft.poll.options.length >= POLL_MAX_OPTIONS}
        onclick={(event) => {
          if (allowed(event))
            entry.editPoll({ options: [...$draft.poll.options, ""] });
        }}>+ {vb.t("opção")}</Button
      >
      <label class="tw:flex tw:items-center tw:gap-2"
        ><Checkbox
          checked={$draft.poll.multi}
          disabled={busy}
          onCheckedChange={(multi) => {
            if (allowed()) entry.editPoll({ multi });
          }}
        /><span>{vb.t("cada pessoa pode escolher várias")}</span></label
      >
      {#if $draft.pollError}<p
          role="alert"
          class="tw:m-0 tw:text-sm tw:text-destructive"
        >
          {$draft.pollError === "poll-invalid"
            ? vb.t("Coloque pelo menos 2 opções.")
            : $draft.pollPhase === "unconfirmed"
              ? vb.t(
                  "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
                )
              : $draft.pollError}
        </p>{/if}
      {#if $draft.pollPhase === "unconfirmed"}<p
          class="tw:m-0 tw:text-xs tw:text-muted-foreground"
        >
          {vb.t("Confira a votação na sala antes de tentar novamente.")}
        </p>
        <Button
          variant="outline"
          onclick={(event) => {
            if (allowed(event)) entry.reviewPoll();
          }}>{vb.t("Conferi a sala; manter rascunho")}</Button
        >{/if}
      <div class="tw:flex tw:justify-end tw:gap-2">
        <Button variant="outline" onclick={() => (open = false)}
          >{vb.t("Cancelar")}</Button
        ><Button
          type="submit"
          disabled={busy}
          aria-busy={$draft.pollPhase === "pending" || undefined}
          >{#if $draft.pollPhase === "pending"}<Spinner size="2xs" />{/if}{vb.t(
            "Criar votação",
          )}</Button
        >
      </div>
    </form>
  </DialogContent>
</Dialog>
