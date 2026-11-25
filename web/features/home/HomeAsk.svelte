<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { get, writable } from "svelte/store";
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import Button from "../../lib/studio/Button.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Chip from "../../lib/studio/Chip.svelte";
  import ChatField from "../composer/ChatField.svelte";
  import ComposerMenuItems from "../composer/ComposerMenuItems.svelte";
  import AttachmentCards from "../composer/AttachmentCards.svelte";
  import PollCreateDialog, {
    type PollForm,
  } from "../composer/PollCreateDialog.svelte";
  import {
    FILE_ACCEPT,
    composerError,
    type PendingAttachment,
  } from "../composer/model";
  import { blankPoll, cleanPoll, type ComposerPhase } from "../composer/drafts";
  import { createApplicationCopy } from "../application/copy";
  import type { PersonalSession } from "./personal";
  import { createHomeSession } from "./session";
  import { homeText, homeIssue, type HomeLanguage } from "./copy";
  import { destinations, type RoomTarget } from "./model";
  /**
   * The home's ask box: the room's chat box, as is. What you write goes to the
   * room and thread it fits (the home session routes it), shown as one line
   * with the destination, its two buttons and the other places as chips.
   * The desk home and the Inbox at zero both use it.
   */
  let {
    personal,
    lang,
    onnavigate,
    onnew,
    onsearch,
    compact = false,
    dock = false,
  }: {
    personal: PersonalSession;
    lang: HomeLanguage;
    onnavigate: (target: RoomTarget) => void;
    onnew: (trigger?: HTMLElement) => void;
    onsearch: () => void;
    /** A narrow column (the Inbox's list): the short placeholder, on one line. */
    compact?: boolean;
    /** Docked at a phone home's foot (HomePanel): the field's bigger controls. */
    dock?: boolean;
  } = $props();
  const draft = $derived(personal.draft);
  const mobile = new MediaQuery(MOBILE_QUERY);
  const session = untrack(() => createHomeSession(personal, onnavigate)),
    view = session.state;
  onDestroy(() => session.dispose());
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const t = $derived(createApplicationCopy(lang));
  let sendButton = $state<HTMLElement | null>(null);
  $effect(() => {
    if ($view.result)
      void tick().then(() => {
        if (sendButton?.isConnected) sendButton.focus();
      });
  });
  // Images show as the composer shows them: a preview of the picked file, revoked when it leaves the ask.
  const previews = new Map<number, string>();
  function preview(item: PendingAttachment) {
    if (!item.file || !item.type.startsWith("image/")) return undefined;
    let url = previews.get(item.id);
    if (!url) previews.set(item.id, (url = URL.createObjectURL(item.file)));
    return url;
  }
  $effect(() => {
    const held = $view.files;
    untrack(() => {
      for (const [id, url] of previews)
        if (!held.some((item) => item.id === id)) {
          URL.revokeObjectURL(url);
          previews.delete(id);
        }
    });
  });
  onDestroy(() => {
    for (const url of previews.values()) URL.revokeObjectURL(url);
  });
  let fileInput = $state<HTMLInputElement | null>(null),
    pollOpen = $state(false);
  // The poll dialog edits a poll the ask holds (the room's composer posts it at once; here it waits for the send).
  const pollState = writable({
    poll: blankPoll(),
    pollPhase: "idle" as ComposerPhase,
    pollError: "",
    notice: "",
  });
  const pollForm: PollForm = {
    state: pollState,
    editPoll(patch) {
      pollState.update((s) => ({
        ...s,
        poll: { ...s.poll, ...patch, revision: s.poll.revision + 1 },
        pollError: "",
      }));
    },
    createPoll() {
      const poll = cleanPoll(get(pollState).poll);
      if (!poll) {
        pollState.update((s) => ({ ...s, pollError: "poll-invalid" }));
        return;
      }
      session.setPoll(poll);
      pollOpen = false;
    },
    reviewPoll() {},
  };
  function openPoll() {
    const held = $view.poll;
    pollState.set({
      poll: held
        ? {
            question: held.question,
            options: [...held.options, ""],
            multi: held.multi,
            revision: 0,
          }
        : blankPoll(),
      pollPhase: "idle",
      pollError: "",
      notice: "",
    });
    pollOpen = true;
  }
  const pasted = (event: ClipboardEvent) => {
    let files = [...(event.clipboardData?.files || [])];
    if (!files.length)
      files = [...(event.clipboardData?.items || [])]
        .filter((item) => item.kind === "file")
        .flatMap((item) => {
          const file = item.getAsFile();
          return file ? [file] : [];
        });
    if (!files.length) return;
    event.preventDefault();
    session.addFiles(files);
  };
  const place = (choice: ReturnType<typeof destinations>[number]) =>
    choice.book_id
      ? choice.book_title + (choice.epic_title ? " › " + choice.epic_title : "")
      : text("newDestination", { title: choice.book_title });
</script>

<!-- Paste and drop files into the ask, as into a room's composer. -->
<div
  class="w-full"
  role="presentation"
  onpaste={pasted}
  ondragover={(event) => {
    if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
  }}
  ondrop={(event) => {
    const files = [...(event.dataTransfer?.files || [])];
    if (!files.length) return;
    event.preventDefault();
    session.addFiles(files);
  }}
>
  <ChatField
    id="home-ask"
    maxlength={2000}
    label={text("ask")}
    placeholder={mobile.current || compact
      ? text("deskAskShort")
      : text("deskAsk")}
    value={$draft.ask}
    onedit={(value) => session.edit(value)}
    onsubmit={() => void session.suggest()}
    {t}
    locale={lang === "en" ? "en-US" : "pt-BR"}
    disabled={$view.busy === "send"}
    busy={!!$view.busy}
    pending={$view.busy === "route"}
    ready={!!$draft.ask.trim() || !!$view.poll}
    sendDisabled={!$draft.ask.trim() && !$view.poll}
    {dock}
  >
    {#snippet above()}
      {#if $view.poll}<div data-home-ask-poll class="flex px-2 pt-2">
          <Chip title={$view.poll.question} class="max-w-full pr-0.5"
            ><Icon icon="bar-chart-square-02" size={12} /><button
              type="button"
              class="min-w-0 cursor-pointer truncate text-foreground"
              onclick={openPoll}
              >{t("Votação: {question}", {
                question: $view.poll.question,
              })}</button
            ><IconButton
              label={t("Remover votação")}
              size="icon-xs"
              class="size-5 shrink-0 rounded-full text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
              disabled={$view.busy === "send"}
              onclick={() => session.setPoll(null)}
              ><Icon icon="x" size={12} /></IconButton
            ></Chip
          >
        </div>{/if}
      <AttachmentCards
        items={$view.files}
        {preview}
        {t}
        onremove={(id) => session.removeFile(id)}
      />
    {/snippet}
    {#snippet menu(close, trigger)}<ComposerMenuItems
        {t}
        {close}
        onattach={() => fileInput?.click()}
        onmention={() => {
          const ask = $draft.ask;
          session.edit(ask && !/\s$/.test(ask) ? `${ask} @` : `${ask}@`);
        }}
        onpoll={openPoll}
        >{#snippet before()}<Button
            variant="menu"
            role="menuitem"
            onclick={() => {
              close();
              onnew(trigger ?? undefined);
            }}><Icon icon="plus" />{text("new")}</Button
          >{/snippet}</ComposerMenuItems
      >{/snippet}
  </ChatField>
  <input
    bind:this={fileInput}
    type="file"
    class="hidden"
    accept={FILE_ACCEPT}
    multiple
    hidden
    onchange={(event) => {
      session.addFiles([...(event.currentTarget.files || [])]);
      event.currentTarget.value = "";
    }}
  />
  {#if $view.fileError}<p
      role="alert"
      class="m-0 mt-1 break-words text-xs text-destructive"
    >
      {composerError($view.fileError, t)}
    </p>{/if}
  <PollCreateDialog form={pollForm} {t} bind:open={pollOpen} />
</div>
<!-- Where the ask goes: one line with the destination and its two buttons, the
     reason under it, and the other places as chips. -->
<div class="w-full">
  {#if $view.result}{@const choices = destinations(
      $view.result,
    )}{@const selected = choices[$view.selected]!}
    <div
      data-home-suggestion
      class="flex flex-col gap-2 rounded-2xl bg-card p-3 pl-4 text-left shadow-edge"
    >
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p aria-live="polite" class="m-0 min-w-0 flex-1 basis-48 break-words">
          <span class="text-muted-foreground">{text("deskSendTo")}</span>
          <b class="font-medium">{place(selected)}</b>
        </p>
        <div class="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={$view.busy === "send"}
            onclick={() => session.cancel()}>{text("cancel")}</Button
          ><Button
            size="sm"
            bind:ref={sendButton}
            aria-busy={$view.busy === "send" || undefined}
            disabled={$view.busy === "send"}
            onclick={() => session.send()}
            >{#if $view.busy === "send"}<Spinner size="xs" />{/if}{text(
              "send",
            )}</Button
          >
        </div>
      </div>
      {#if $view.selected === 0 && $view.result.pick && $view.result.reason}<p
          class="m-0 text-xs leading-5 text-muted-foreground"
        >
          {$view.result.reason}
        </p>{/if}
      {#if choices.length > 1}<div
          class="flex flex-wrap items-center gap-1.5 border-t border-border pt-2"
        >
          <span class="text-xs text-muted-foreground">{text("deskOr")}</span>
          {#each choices as choice, index}{#if index !== $view.selected}<Button
                size="sm"
                variant="outline"
                disabled={!!$view.busy}
                class="h-7 max-w-full rounded-full px-3 text-xs"
                onclick={() => {
                  session.select(index);
                  void tick().then(() => {
                    if (sendButton?.isConnected) sendButton.focus();
                  });
                }}><span class="truncate">{place(choice)}</span></Button
              >{/if}{/each}
        </div>{/if}
    </div>{/if}
  {#if $view.error}<p role="alert" class="m-0 break-words text-destructive">
      {homeIssue(lang, $view.error)}
    </p>{/if}
</div>
