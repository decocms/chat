<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import Button from "../../lib/studio/Button.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import ChatField from "../composer/ChatField.svelte";
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
  }: {
    personal: PersonalSession;
    lang: HomeLanguage;
    onnavigate: (target: RoomTarget) => void;
    onnew: (trigger?: HTMLElement) => void;
    onsearch: () => void;
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
  const place = (choice: ReturnType<typeof destinations>[number]) =>
    choice.book_id
      ? choice.book_title + (choice.epic_title ? " › " + choice.epic_title : "")
      : text("newDestination", { title: choice.book_title });
</script>

<div class="w-full">
  <ChatField
    id="home-ask"
    maxlength={2000}
    label={text("ask")}
    placeholder={mobile.current ? text("deskAskShort") : text("deskAsk")}
    value={$draft.ask}
    onedit={(value) => session.edit(value)}
    onsubmit={() => void session.suggest()}
    {t}
    locale={lang === "en" ? "en-US" : "pt-BR"}
    disabled={$view.busy === "send"}
    busy={!!$view.busy}
    pending={$view.busy === "route"}
    sendDisabled={!$draft.ask.trim()}
  >
    {#snippet menu(close, trigger)}<Button
        variant="menu"
        role="menuitem"
        onclick={() => {
          close();
          onnew(trigger ?? undefined);
        }}><Icon icon="plus" />{text("new")}</Button
      ><Button
        variant="menu"
        role="menuitem"
        onclick={() => {
          close();
          const ask = $draft.ask;
          session.edit(ask && !/\s$/.test(ask) ? `${ask} @` : `${ask}@`);
        }}><Icon icon="at-sign" />{t("Mencionar alguém")}</Button
      >{/snippet}
  </ChatField>
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
