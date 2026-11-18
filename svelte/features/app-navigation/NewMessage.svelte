<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import { Plus } from "../../lib/studio/icons";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { navRow } from "../../lib/components/navRow";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { avatarUrl } from "../home/model";
  import { isEmail } from "../people/model";
  import type { MeResult } from "../../../shared/schemas";
  import { contacts, matchContacts } from "./contacts";
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
  }: {
    me: MeResult;
    lang: HomeLanguage;
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

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}<IconButton
        {...props}
        size="icon-xs"
        tooltipSide="bottom"
        label={text("newMessage")}
        data-new-message><Icon icon={Plus} /></IconButton
      >{/snippet}
  </PopoverTrigger>
  <PopoverContent
    side="bottom"
    align="end"
    sideOffset={6}
    data-vb-native
    data-new-message-panel
    class="tw:flex tw:w-80 tw:max-w-[calc(100vw-16px)] tw:flex-col tw:gap-2 tw:p-2 tw:font-sans"
  >
    <p class="tw:m-0 tw:px-1 tw:text-sm tw:font-medium">
      {text("newMessage")}
    </p>
    {#if target}
      <form
        class="tw:flex tw:flex-col tw:gap-2"
        onsubmit={(event) => {
          event.preventDefault();
          if (target && draft.trim()) void go(target, draft.trim());
        }}
      >
        <p class="tw:m-0 tw:px-1 tw:text-sm tw:break-words">
          {text("writeTo", { email: target })}
        </p>
        <p class="tw:m-0 tw:px-1 tw:text-xs tw:text-muted-foreground">
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
        <div class="tw:flex tw:justify-end tw:gap-1">
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
        type="search"
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
      {#if sent}<p
          role="status"
          class="tw:m-0 tw:px-1 tw:text-xs tw:text-muted-foreground"
        >
          ✓ {text("requestSent")}
        </p>{/if}
      <ul
        class="tw:m-0 tw:flex tw:max-h-72 tw:list-none tw:flex-col tw:gap-0.5 tw:overflow-y-auto tw:p-0"
      >
        {#each found as person (person.email)}<li>
            <button
              type="button"
              data-contact={person.email}
              class={navRow({ class: "tw:w-full tw:text-left" })}
              disabled={busy}
              onclick={() => go(person.email)}
              ><PersonAvatar
                size="sm"
                name={person.name || person.email}
                url={avatarUrl(person.email, person.avatar)}
              /><span class="tw:min-w-0 tw:flex-1">
                <span class="tw:block tw:truncate"
                  >{person.name || person.email}</span
                >{#if person.rooms.length}<span
                    class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
                    >{text("inRooms", {
                      rooms: person.rooms.join(", "),
                    })}</span
                  >{/if}</span
              ></button
            >
          </li>{/each}
        {#if stranger}<li>
            <button
              type="button"
              data-contact-stranger
              class={navRow({ class: "tw:w-full tw:text-left" })}
              disabled={busy}
              onclick={() => (target = typed)}
              ><PersonAvatar size="sm" name={typed} /><span
                class="tw:min-w-0 tw:flex-1 tw:truncate"
                >{text("writeTo", { email: typed })}</span
              ></button
            >
          </li>{:else if typed && !found.length}<li
            class="tw:px-2 tw:py-1 tw:text-xs tw:text-muted-foreground"
          >
            {text("noPeople")}
          </li>{/if}
      </ul>
      {#if waiting.length}<div class="tw:border-t tw:border-border tw:pt-2">
          <p
            class="tw:m-0 tw:px-1 tw:pb-1 tw:text-xs tw:font-medium tw:text-muted-foreground"
          >
            {text("sentList")}
          </p>
          <ul class="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-0.5 tw:p-0">
            {#each waiting as request (request.email)}<li
                data-sent-request={request.email}
                class="tw:flex tw:items-center tw:gap-2 tw:px-2 tw:py-1"
              >
                <PersonAvatar size="sm" name={request.email} /><span
                  class="tw:min-w-0 tw:flex-1"
                  ><span class="tw:block tw:truncate tw:text-sm"
                    >{request.email}</span
                  ><span
                    class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
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
    {#if failed}<p
        role="alert"
        class="tw:m-0 tw:px-1 tw:text-xs tw:text-destructive"
      >
        {text("requestFailed")}
      </p>{/if}
  </PopoverContent>
</Popover>
