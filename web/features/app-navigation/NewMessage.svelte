<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import Drawer from "../../lib/studio/Drawer.svelte";
  import DrawerContent from "../../lib/studio/DrawerContent.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { navRow } from "../../lib/components/navRow";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { isEmail } from "../people/model";
  import type { MeResult } from "../../../shared/schemas";
  import { contacts, matchContacts } from "./contacts";
  import type { Snippet } from "svelte";
  /**
   * The `+` on "Mensagens diretas". Someone from your rooms opens the DM at
   * once; an email outside them goes as a message request with a first
   * message, opened when they accept. Your requests waiting for an answer sit
   * under "Enviados", with Cancelar.
   */
  let {
    me,
    lang,
    onconnect,
    ondismiss,
    trigger,
    onroom,
    side = "bottom",
    sheet = false,
  }: {
    me: MeResult;
    lang: HomeLanguage;
    /** Another button that opens it (the phone's home `+`), instead of the small `+`. */
    trigger?: Snippet<[{ props: Record<string, unknown> }]>;
    /** A "Nova sala" row on top: the phone's `+` makes a DM or a room (Gui #4572). */
    onroom?: (trigger?: HTMLElement) => void;
    side?: "bottom" | "top";
    /** Phone: a sheet from the bottom, the screen's width, in place of the popover (Gimenes #6146, #6161). */
    sheet?: boolean;
    /** Resolves with the DM's id when it opened, or nothing when it went as a request. */
    onconnect?: (email: string, text?: string) => Promise<string | undefined>;
    ondismiss?: (email: string) => Promise<void>;
  } = $props();
  const text = (key: Parameters<typeof homeText>[1], vars = {}) =>
    homeText(lang, key, vars);
  let open = $state(false),
    query = $state(""),
    draft = $state(""),
    target = $state<string | null>(null),
    busy = $state(false),
    sent = $state(false),
    failed = $state(false);
  const all = $derived(contacts(me));
  const found = $derived(matchContacts(all, query));
  const typed = $derived(query.trim().toLowerCase());
  const stranger = $derived(
    isEmail(typed) &&
      typed !== me.email &&
      !all.some((person) => person.email === typed),
  );
  const waiting = $derived(me.sent.filter((request) => !request.declined));
  // In the phone's sheet the rows are as tall as the Chats list's, for the thumb.
  const row = $derived(
    navRow({ class: sheet ? "min-h-14 w-full text-left" : "w-full text-left" }),
  );
  const avatar = $derived(sheet ? "base" : "sm");
  $effect(() => {
    if (!open) {
      query = draft = "";
      target = null;
      sent = failed = false;
    }
  });
  async function go(email: string, first?: string) {
    if (busy || !onconnect) return;
    busy = true;
    failed = false;
    try {
      const id = await onconnect(email, first);
      if (id) open = false;
      else {
        sent = true;
        target = null;
        query = draft = "";
      }
    } catch {
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

{#snippet button(props: Record<string, unknown>)}{#if trigger}{@render trigger({
      props,
    })}{:else}<IconButton
      {...props}
      size="icon-xs"
      tooltipSide="bottom"
      label={text("newMessage")}
      data-new-message><Icon icon="plus" /></IconButton
    >{/if}{/snippet}
{#snippet panel()}
  {#if onroom}<button
      type="button"
      data-new-room
      class={row}
      onclick={(event) => {
        open = false;
        onroom(event.currentTarget);
      }}
      >{#if sheet}<span
          class="grid size-10 shrink-0 place-items-center rounded-full bg-muted"
          ><Icon icon="plus" class="size-5" /></span
        >{:else}<Icon icon="plus" class="size-5 shrink-0" />{/if}<span
        class="min-w-0 flex-1 truncate">{text("new")}</span
      ></button
    >{/if}
  <p class="m-0 px-1 text-sm font-medium">
    {text("newMessage")}
  </p>
  {#if target}
    <form
      class="flex flex-col gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        if (target && draft.trim()) void go(target, draft.trim());
      }}
    >
      <p class="m-0 px-1 text-sm break-words">
        {text("writeTo", { email: target })}
      </p>
      <p class="m-0 px-1 text-xs text-muted-foreground">
        {text("requestNote")}
      </p>
      <Textarea
        bind:value={draft}
        rows={3}
        maxlength={2000}
        aria-label={text("firstMessage")}
        placeholder={text("firstMessage")}
        disabled={busy}
      />
      <div class="flex justify-end gap-1">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={busy}
          onclick={() => (target = null)}>{text("cancel")}</Button
        ><Button
          size="sm"
          type="submit"
          disabled={busy || !draft.trim()}
          aria-busy={busy || undefined}>{text("sendRequest")}</Button
        >
      </div>
    </form>
  {:else}
    <Input
      bind:value={query}
      type="text"
      inputmode="search"
      autocomplete="off"
      aria-label={text("newMessageHint")}
      placeholder={text("newMessageHint")}
      onkeydown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (found[0]) void go(found[0].email);
        else if (stranger) target = typed;
      }}
    />
    {#if sent}<p role="status" class="m-0 px-1 text-xs text-muted-foreground">
        ✓ {text("requestSent")}
      </p>{/if}
    <ul
      class={[
        "m-0 flex list-none flex-col gap-0.5 p-0",
        !sheet && "max-h-72 overflow-y-auto",
      ]}
    >
      {#each found as person (person.email)}<li>
          <button
            type="button"
            data-contact={person.email}
            class={row}
            disabled={busy}
            onclick={() => go(person.email)}
            ><PersonAvatar
              size={avatar}
              email={person.email}
              version={person.avatar}
            /><span class="min-w-0 flex-1">
              <span class="block truncate">{person.name || person.email}</span
              >{#if person.rooms.length}<span
                  class="block truncate text-xs text-muted-foreground"
                  >{text("inRooms", {
                    rooms: person.rooms.join(", "),
                  })}</span
                >{:else if person.domain}<span
                  class="block truncate text-xs text-muted-foreground"
                  >{text("sameDomain", {
                    domain: person.email.split("@")[1] ?? "",
                  })}</span
                >{/if}</span
            ></button
          >
        </li>{/each}
      {#if stranger}<li>
          <button
            type="button"
            data-contact-stranger
            class={row}
            disabled={busy}
            onclick={() => (target = typed)}
            ><PersonAvatar size={avatar} email={typed} /><span
              class="min-w-0 flex-1 truncate"
              >{text("writeTo", { email: typed })}</span
            ></button
          >
        </li>{:else if typed && !found.length}<li
          class="px-2 py-1 text-xs text-muted-foreground"
        >
          {text("noPeople")}
        </li>{/if}
    </ul>
    {#if waiting.length}<div class="border-t border-border pt-2">
        <p class="m-0 px-1 pb-1 text-xs font-medium text-muted-foreground">
          {text("sentList")}
        </p>
        <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
          {#each waiting as request (request.email)}<li
              data-sent-request={request.email}
              class="flex items-center gap-2 px-2 py-1"
            >
              <PersonAvatar size="sm" email={request.email} /><span
                class="min-w-0 flex-1"
                ><span class="block truncate text-sm">{request.email}</span
                ><span class="block truncate text-xs text-muted-foreground"
                  >{text("waitingAnswer")}</span
                ></span
              ><Button
                variant="ghost"
                size="xs"
                disabled={busy || !ondismiss}
                onclick={() => ondismiss?.(request.email)}
                >{text("cancel")}</Button
              >
            </li>{/each}
        </ul>
      </div>{/if}
  {/if}
  {#if failed}<p role="alert" class="m-0 px-1 text-xs text-destructive">
      {text("requestFailed")}
    </p>{/if}
{/snippet}
{#if sheet}
  {@render button({
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onclick: () => (open = true),
  })}
  <Drawer bind:open>
    <DrawerContent
      side="bottom"
      closeLabel={text("close")}
      data-new-message-panel
      data-new-message-sheet
      class="gap-2 overflow-y-auto px-3 font-sans"
    >
      <SheetTitle class="sr-only">{text("newMessage")}</SheetTitle>
      {@render panel()}
    </DrawerContent>
  </Drawer>
{:else}
  <Popover bind:open>
    <PopoverTrigger>
      {#snippet child({ props })}{@render button(props)}{/snippet}
    </PopoverTrigger>
    <PopoverContent
      {side}
      align="end"
      sideOffset={6}
      data-new-message-panel
      class="flex w-80 max-w-[calc(100vw-16px)] flex-col gap-2 p-2 font-sans"
    >
      {@render panel()}
    </PopoverContent>
  </Popover>
{/if}
